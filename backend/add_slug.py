import os, django
from django.db import connection, transaction
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

try:
    with connection.cursor() as cursor:
        cursor.execute("ALTER TABLE users_user ADD COLUMN IF NOT EXISTS slug varchar(80) NULL;")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_user_slug_key ON users_user(slug);")
    print('Committed slug column')
except Exception as e:
    print('Failed:', e)
