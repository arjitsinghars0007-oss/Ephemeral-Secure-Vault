FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/

RUN mkdir -p /app/uploads

EXPOSE 8000

# Note: SSL should be terminated at the reverse proxy (nginx/caddy) in production.
# For local dev with SSL, pass --ssl-keyfile and --ssl-certfile via env or override.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

