FROM python:3.11-slim

# Avoid .pyc files and enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# System build essentials (extend if a lib needs compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for better layer caching
COPY backend/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the backend source
COPY backend/ .

EXPOSE ${PORT}

# Run FastAPI via uvicorn
CMD ["uvicorn", "adk_app.api.app:app", "--host", "0.0.0.0", "--port", "8000"]