# Ephemeral Secure Vault 🔒

A self-hosted, full-stack secure file storage system with **24-hour auto-expiration** and **burn-on-read** mechanics. Built with a focus on server-side encryption, safe concurrency, and containerized deployment.

## ✨ Features

- **Burn-On-Read:** Files are permanently deleted from the database and disk immediately after their first download. No second chances.
- **Auto-Expiration:** A background sweeper task runs every 60 seconds and purges any files older than 24 hours.
- **Server-Side Encryption:** Files are encrypted using [Fernet](https://cryptography.io/en/latest/fernet/) symmetric encryption before touching the disk. The decryption key is generated per-file, **never stored on the server**, and returned only once at upload time — save it.
- **Secure Authentication:** Upload routes are protected via an `X-API-Key` header. Configure the key via the `VAULT_API_KEY` environment variable.
- **Race-Condition Safe:** The download route uses a `SELECT ... FOR UPDATE` row lock, preventing two concurrent requests from both successfully burning the same file.
- **Modern UI:** Dark-mode React interface with drag-and-drop uploads, inline toast notifications, one-click clipboard copying, and live countdown timers.
- **Database Concurrency:** SQLite configured in Write-Ahead Logging (WAL) mode for smooth concurrent reads/writes.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v3 |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x, SQLite |
| Encryption | `cryptography` (Fernet / AES-128-CBC) |
| Infrastructure | Docker, Docker Compose V2 |

## 🚀 Quick Start (Docker Compose)

### Prerequisites

- Docker and Docker Compose V2 installed.

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Ephemeral-Secure-Vault.git
cd Ephemeral-Secure-Vault
```

### 2. (Optional) Set a custom API key

The default API key is `secure-vault-2026`. For production, override it:

```bash
export VAULT_API_KEY=your-strong-random-key-here
```

### 3. Start the application

```bash
docker compose up --build
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs

### 4. Stop and clean up

```bash
docker compose down
```

To also remove persisted volumes (uploaded files and database):

```bash
docker compose down -v
```

---

## 🔧 Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 API Reference

All endpoints are documented interactively at `/docs` when the server is running.

### `POST /upload`

**Headers:** `X-API-Key: <your-key>`, `Content-Type: multipart/form-data`

**Body:** `file` (form-data file field)

**Response:**
```json
{
  "message": "File encrypted and stored successfully",
  "file_id": "a3f8...",
  "decryption_key": "...",
  "warning": "Save the decryption key now — it is not stored on the server."
}
```

---

### `POST /download/{file_id}`

**Headers:** `Content-Type: application/json`

**Body:**
```json
{ "decryption_key": "your-key-here" }
```

**Response:** Raw file binary stream (`application/octet-stream`). The file is **permanently destroyed** after this call succeeds.

**Error codes:**
- `404` — File not found or already burned.
- `410` — File expired or already viewed.
- `400` — Invalid decryption key.

---

### `GET /health`

Returns `{"status": "ok"}`. Used by Docker health checks.

---

## ⚙️ Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `VAULT_API_KEY` | `secure-vault-2026` | API key required to upload files |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins |

---

## 🏗️ Project Structure

```
secure-vault/
├── backend/
│   ├── main.py          # FastAPI app, routes, background sweeper
│   ├── models.py        # SQLAlchemy FileMetadata model
│   ├── database.py      # DB engine, session factory (WAL mode)
│   ├── security.py      # Fernet encrypt/decrypt helpers
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   └── App.jsx      # Main React application
│   ├── vite.config.js   # Vite + dev proxy config
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🔒 Security Notes

- **Decryption keys travel in the POST body** (not URL query params) to prevent leakage in server access logs or browser history.
- **CORS** is restricted to the configured `ALLOWED_ORIGINS`. Do not use `*` with credentials in production.
- **SSL/TLS termination** should be handled by a reverse proxy (Nginx, Caddy) in production — not by Uvicorn directly.
- **SQLite** is suitable for single-node personal/team use. For high-concurrency production deployments, migrate to PostgreSQL.
### 1. Clone the repository

```bash
git clone https://github.com/your-username/Ephemeral-Secure-Vault.git
cd Ephemeral-Secure-Vault
```

### 2. (Optional) Set a custom API key

The default API key is `secure-vault-2026`. For production, override it:

```bash
export VAULT_API_KEY=your-strong-random-key-here
```

### 3. Start the application

```bash
docker compose up --build
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs

### 4. Stop and clean up

```bash
docker compose down
```

To also remove persisted volumes (uploaded files and database):

```bash
docker compose down -v
```

---

## 🔧 Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 API Reference

All endpoints are documented interactively at `/docs` when the server is running.

### `POST /upload`

**Headers:** `X-API-Key: <your-key>`, `Content-Type: multipart/form-data`

**Body:** `file` (form-data file field)

**Response:**
```json
{
  "message": "File encrypted and stored successfully",
  "file_id": "a3f8...",
  "decryption_key": "...",
  "warning": "Save the decryption key now — it is not stored on the server."
}
```

---

### `POST /download/{file_id}`

**Headers:** `Content-Type: application/json`

**Body:**
```json
{ "decryption_key": "your-key-here" }
```

**Response:** Raw file binary stream (`application/octet-stream`). The file is **permanently destroyed** after this call succeeds.

**Error codes:**
- `404` — File not found or already burned.
- `410` — File expired or already viewed.
- `400` — Invalid decryption key.

---

### `GET /health`

Returns `{"status": "ok"}`. Used by Docker health checks.

---

## ⚙️ Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `VAULT_API_KEY` | `secure-vault-2026` | API key required to upload files |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins |

---

## 🏗️ Project Structure

```
secure-vault/
├── backend/
│   ├── main.py          # FastAPI app, routes, background sweeper
│   ├── models.py        # SQLAlchemy FileMetadata model
│   ├── database.py      # DB engine, session factory (WAL mode)
│   ├── security.py      # Fernet encrypt/decrypt helpers
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   └── App.jsx      # Main React application
│   ├── vite.config.js   # Vite + dev proxy config
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🔒 Security Notes

- **Decryption keys travel in the POST body** (not URL query params) to prevent leakage in server access logs or browser history.
- **CORS** is restricted to the configured `ALLOWED_ORIGINS`. Do not use `*` with credentials in production.
- **SSL/TLS termination** should be handled by a reverse proxy (Nginx, Caddy) in production — not by Uvicorn directly.
- **SQLite** is suitable for single-node personal/team use. For high-concurrency production deployments, migrate to PostgreSQL.
