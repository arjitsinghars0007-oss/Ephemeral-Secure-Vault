import os
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Response, Security, status
from fastapi.security.api_key import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet

# 1. Import database helpers (including SessionLocal for background tasks)
from database import Base, engine, get_db, SessionLocal

# 2. Define the FileMetadata model
class FileMetadata(Base):
    __tablename__ = "files"
    id = Column(String, primary_key=True, default=lambda: str(os.urandom(16).hex()))
    original_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    views_allowed = Column(Integer, default=1)

# Ensure database tables exist
Base.metadata.create_all(bind=engine)


# --- BACKGROUND SWEEPER TASK ---
async def sweep_expired_files():
    """Periodically checks for expired files, deletes them from disk, and removes DB records."""
    while True:
        try:
            # Check every 60 seconds (adjust interval as needed)
            await asyncio.sleep(60)
            
            db = SessionLocal()
            try:
                now = datetime.utcnow()
                expired_files = db.query(FileMetadata).filter(FileMetadata.expires_at < now).all()
                
                if expired_files:
                    for db_file in expired_files:
                        filepath = os.path.join("uploads", f"{db_file.id}.enc")
                        if os.path.exists(filepath):
                            os.remove(filepath)
                        db.delete(db_file)
                    
                    db.commit()
                    print(f"[SWEEPER] Purged {len(expired_files)} expired file(s) from vault.")
            finally:
                db.close()

        except asyncio.CancelledError:
            print("[SWEEPER] Background task cancelled.")
            break
        except Exception as e:
            print(f"[SWEEPER ERROR] Exception during file sweep: {e}")


# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background sweeper loop
    sweeper_task = asyncio.create_task(sweep_expired_files())
    print("[SERVER STARTUP] Background expired-file sweeper initialized.")
    yield
    # Shutdown: Cleanly cancel the sweeper task when Uvicorn stops
    sweeper_task.cancel()
    try:
        await sweeper_task
    except asyncio.CancelledError:
        pass
    print("[SERVER SHUTDOWN] Background sweeper terminated.")


# 3. Initialize FastAPI app with the lifespan manager
app = FastAPI(title="Ephemeral Vault API", lifespan=lifespan)

# --- API KEY SECURITY ---
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
# Reads key from environment variable, or defaults to "secure-vault-2026"
EXPECTED_API_KEY = os.getenv("VAULT_API_KEY", "secure-vault-2026")

def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    if api_key != EXPECTED_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid or missing API Key"
        )
    return api_key


# --- UPLOAD ROUTE (Optimized & Secured) ---
@app.post("/upload")
def upload_file(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key)  # Route is now locked with API key
):
    os.makedirs("uploads", exist_ok=True)
    
    # Synchronous read to prevent event loop blocking under heavy load
    file_content = file.file.read()
    
    encryption_key = Fernet.generate_key().decode()
    cipher_suite = Fernet(encryption_key.encode())
    encrypted_data = cipher_suite.encrypt(file_content)
    
    # Pre-generate the file ID and construct the storage path
    file_id = str(os.urandom(16).hex())
    file_path = f"uploads/{file_id}.enc"
    
    # Pass the required storage_path to satisfy the NOT NULL constraint
    db_file = FileMetadata(
        id=file_id,
        original_filename=file.filename,
        storage_path=file_path,
        expires_at=datetime.utcnow() + timedelta(hours=24),
        views_allowed=1
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    with open(file_path, "wb") as f:
        f.write(encrypted_data)
        
    return {
        "message": "File secured successfully",
        "file_id": db_file.id,
        "decryption_key": encryption_key,
        "warning": "Save this key now. The server does not store it."
    }


# --- DOWNLOAD & BURN ROUTE ---
@app.post("/download/{file_id}")
def download_file(file_id: str, decryption_key: str, db: Session = Depends(get_db)):
    db_file = db.query(FileMetadata).filter(FileMetadata.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    if datetime.utcnow() > db_file.expires_at:
        raise HTTPException(status_code=410, detail="File time limit expired")
        
    if db_file.views_allowed <= 0:
        raise HTTPException(status_code=410, detail="File has already been viewed and destroyed.")
        
    filepath = os.path.join("uploads", f"{file_id}.enc") 
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File has expired or was already destroyed.")

    with open(filepath, "rb") as f:
        encrypted_data = f.read()

    try:
        cipher_suite = Fernet(decryption_key.encode())
        decrypted_data = cipher_suite.decrypt(encrypted_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid decryption key or corrupted file.")

    os.remove(filepath)
    db.delete(db_file)
    db.commit()
    
    return Response(
        content=decrypted_data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{db_file.original_filename}"'}
    )


# --- STATIC FILES MOUNT ---
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")



