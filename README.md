# Ephemeral Secure Vault 🔒

A self-hosted, full-stack secure file storage system with 24-hour auto-expiration and one-time read (burn-on-read) mechanics. Built with a focus on local encryption, secure concurrency, and containerized deployment.

## ✨ Features

* **Burn-On-Read:** Files are permanently destroyed from the database and disk immediately after their first download.
* **Auto-Expiration:** A background sweeper task automatically purges any files older than 24 hours.
* **End-to-End Encryption:** Files are synchronously encrypted on the backend using `cryptography` (Fernet) before touching the disk. Decryption keys are generated per-file and never stored on the server.
* **Secure Authentication:** API routes are protected via an `X-API-Key` header requirement.
* **Modern UI:** A sleek, dark-mode React interface featuring drag-and-drop uploads, one-click clipboard copying, and live countdown timers.
* **Database Concurrency:** SQLite configured in Write-Ahead Logging (WAL) mode to handle concurrent database reads/writes smoothly.

## 🛠️ Tech Stack

* **Frontend:** React, Vite (configured with local HTTPS), Tailwind CSS (v3)
* **Backend:** Python, FastAPI, SQLAlchemy, SQLite
* **Infrastructure:** Docker, Docker Compose (V2)

## 🚀 Quick Start (Docker)

The easiest way to run this application is via Docker Compose.

### Prerequisites
* Docker and Docker Compose V2 installed on your machine.

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/your-username/Ephemeral-Secure-Vault.git](https://github.com/your-username/Ephemeral-Secure-Vault.git)
   cd Ephemeral-Secure-Vault

   