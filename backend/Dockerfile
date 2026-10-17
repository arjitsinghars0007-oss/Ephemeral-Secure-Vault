FROM python:3.10-slim

WORKDIR /app

# Install the exact dependencies your backend needs
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" sqlalchemy cryptography python-multipart

# Copy your backend code into the container
COPY . /app/

# Expose the port and start the Uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


