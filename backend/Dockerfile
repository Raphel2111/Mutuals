# Backend Dockerfile — ASGI with Daphne for WebSocket support
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000

# Daphne runs Django ASGI — supports both HTTP and WebSocket
# In production: WEB_CONCURRENCY controls worker threads
CMD sh -c "python manage.py migrate --noinput && \
    daphne -b 0.0.0.0 -p 8000 \
    --access-log - \
    evento_app.asgi:application"
