import os
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Response, Security, status
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import Base, engine, get_db, SessionLocal
from models import FileMetadata
from security import generate_key, encrypt_file, decrypt_file

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

CHUNK_SIZE = 1024 * 1024  # 1 MB chunks for streaming reads


# --- BACKGROUND SWEEPER ---
async def sweep_expired_files():
    """Periodically checks for and purges expired files."""
    while True:
        try:
            await asyncio.sleep(60)
            db = SessionLocal()
            try:
                now = datetime.utcnow()
                expired_files = db.query(FileMetadata).filter(FileMetadata.expires_at < now).all()
                if expired_files:
                    for db_file in expired_files:
                        if os.path.exists(db_file.storage_path):
                            os.remove(db_file.storage_path)
                        db.delete(db_file)
                    db.commit()
                    print(f"[SWEEPER] Purged {len(expired_files)} expired file(s).")
            finally:
                db.close()
        except asyncio.CancelledError:
            print("[SWEEPER] Cancelled.")
            break
        except Exception as e:
            print(f"[SWEEPER ERROR] {e}")


# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    sweeper_task = asyncio.create_task(sweep_expired_files())
    print("[STARTUP] Background sweeper started.")
    yield
    sweeper_task.cancel()
    try:
        await sweeper_task
    except asyncio.CancelledError:
        pass
    print("[SHUTDOWN] Background sweeper stopped.")


app = FastAPI(title="Ephemeral Vault API", lifespan=lifespan)

# --- CORS ---
# Restrict to known frontend origin(s). Update for production.
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://localhost:5173,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# --- API KEY ---
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
EXPECTED_API_KEY = os.getenv("VAULT_API_KEY", "secure-vault-2026")

def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    if not api_key or api_key != EXPECTED_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
        )
    return api_key


# --- REQUEST BODY FOR DOWNLOAD ---
class DownloadRequest(BaseModel):
    decryption_key: str


# --- UPLOAD ---
@app.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    os.makedirs("uploads", exist_ok=True)

    # Read in chunks to avoid OOM on large files
    chunks = []
    while True:
        chunk = file.file.read(CHUNK_SIZE)
        if not chunk:
            break
        chunks.append(chunk)
    file_content = b"".join(chunks)

    encryption_key = generate_key()
    encrypted_data = encrypt_file(file_content, encryption_key)

    file_id = os.urandom(16).hex()
    file_path = os.path.join("uploads", f"{file_id}.enc")

    db_file = FileMetadata(
        id=file_id,
        original_filename=file.filename,
        storage_path=file_path,
        expires_at=datetime.utcnow() + timedelta(hours=24),
        views_allowed=1,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    with open(file_path, "wb") as f:
        f.write(encrypted_data)

    return {
        "message": "File encrypted and stored successfully",
        "file_id": db_file.id,
        "decryption_key": encryption_key,
        "warning": "Save the decryption key now — it is not stored on the server and cannot be recovered.",
    }


# --- DOWNLOAD & BURN ---
@app.post("/download/{file_id}")
def download_file(
    file_id: str,
    body: DownloadRequest,
    db: Session = Depends(get_db),
):
    # Lock the row immediately to prevent concurrent burn race condition
    db_file = (
        db.query(FileMetadata)
        .filter(FileMetadata.id == file_id)
        .with_for_update()
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found or already destroyed.")

    if datetime.utcnow() > db_file.expires_at:
        raise HTTPException(status_code=410, detail="File has expired.")

    if db_file.views_allowed <= 0:
        raise HTTPException(status_code=410, detail="File has already been viewed and destroyed.")

    filepath = db_file.storage_path
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File data missing — may have been purged.")

    # Read encrypted file in chunks
    chunks = []
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break
            chunks.append(chunk)
    encrypted_data = b"".join(chunks)

    try:
        decrypted_data = decrypt_file(encrypted_data, body.decryption_key)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid decryption key or corrupted file.")

    # Burn: delete file from disk and DB atomically
    os.remove(filepath)
    db.delete(db_file)
    db.commit()

    return Response(
        content=decrypted_data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{db_file.original_filename}"'},
    )


# --- HEALTH CHECK ---
@app.get("/health")
def health_check():
    return {"status": "ok"}
