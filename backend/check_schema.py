import os, django
from django.db import connection
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

with connection.cursor() as cursor:
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users_user';")
    print('\n'.join([r[0] for r in cursor.fetchall()]))
