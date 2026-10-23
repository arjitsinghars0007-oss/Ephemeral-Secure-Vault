# Backend — Ephemeral Vault API

FastAPI backend for the Ephemeral Secure Vault. Handles file encryption, storage, expiration, and burn-on-read logic.

## Stack

- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.x with SQLite (WAL mode)
- **Encryption:** `cryptography` (Fernet / AES-128-CBC)
- **Server:** Uvicorn

## Running locally

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs available at: http://localhost:8000/docs

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VAULT_API_KEY` | `secure-vault-2026` | Required header for upload |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS origins |

## Module Overview

| File | Purpose |
|---|---|
| `main.py` | App factory, routes, background sweeper lifespan |
| `models.py` | `FileMetadata` SQLAlchemy model |
| `database.py` | Engine, session factory, WAL PRAGMA |
| `security.py` | `generate_key`, `encrypt_file`, `decrypt_file` helpers |

