web: cd backend && python manage.py migrate && gunicorn evento_app.wsgi:application --bind 0.0.0.0:$PORT
release: cd backend && python manage.py migrate
