from cryptography.fernet import Fernet

def generate_key() -> str:
    # Generate and return as a UTF-8 string directly
    return Fernet.generate_key().decode("utf-8")

def encrypt_file(file_bytes: bytes, key: str) -> bytes:
    fernet = Fernet(key.encode("utf-8"))
    return fernet.encrypt(file_bytes)

def decrypt_file(encrypted_bytes: bytes, key: str) -> bytes:
    fernet = Fernet(key.encode("utf-8"))
    return fernet.decrypt(encrypted_bytes)






