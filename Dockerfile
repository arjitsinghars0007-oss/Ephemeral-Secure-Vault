FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/backend/requirements.txt

COPY frontend/ /app/frontend/
COPY backend/ /app/backend/

RUN mkdir -p /app/backend/uploads

WORKDIR /app/backend


# Copy the SSL certificates into the container
COPY cert.pem key.pem /app/backend/

EXPOSE 8000

# Start Uvicorn with SSL enabled
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--ssl-keyfile", "key.pem", "--ssl-certfile", "cert.pem"]



