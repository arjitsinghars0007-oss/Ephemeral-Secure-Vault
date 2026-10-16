# Ephemeral Secure Vault 🔐

An end-to-end encrypted, zero-knowledge ephemeral file-sharing vault built with FastAPI, SQLite (WAL mode), and Docker.

## Features
- **Fernet Encryption**: Files are encrypted with auto-generated Fernet symmetric keys. Keys are returned once to the uploader and never stored on the server.
- **Burn-After-Reading & Auto-Expiration**: Files automatically self-destruct upon download or after 24 hours via an asynchronous background sweeper task.
- **High-Concurrency Database**: SQLite configured with Write-Ahead Logging (WAL) to prevent lock contention under heavy loads.
- **API Key Security**: Upload endpoints guarded by `X-API-Key` header verification.
- **TLS/HTTPS Containerization**: Fully containerized with Docker running Uvicorn over TLS on port 8443.

## Quickstart (Docker)

1. **Build the Docker image:**

