# Backend Dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy project code
COPY . .

# Collect static files
# RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Default command (runs migrations then starts gunicorn)
CMD sh -c "python manage.py migrate --noinput && gunicorn evento_app.wsgi:application --bind 0.0.0.0:8000"
