#!/bin/sh
# Script para ejecutar migraciones y arrancar el servidor

echo "Ejecutando migraciones..."
python manage.py migrate --noinput

echo "Arrancando servidor Gunicorn..."
exec gunicorn evento_app.wsgi:application --bind 0.0.0.0:8000
