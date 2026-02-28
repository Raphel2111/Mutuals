import os, django
from django.db import connection
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

with connection.cursor() as cursor:
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'events_%';")
    tables = [r[0] for r in cursor.fetchall()]
    print('Tables found:', tables)
    for table in tables:
        print(f'Dropping {table}...')
        cursor.execute(f"DROP TABLE {table} CASCADE;")
    
    # Also reset the migration history for events
    cursor.execute("DELETE FROM django_migrations WHERE app='events';")
    connection.commit()
    print('Cleared events tables and migration history.')
