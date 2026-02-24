import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from django.db import connection

def clean_database():
    print("Limpiando la base de datos PostgreSQL...")
    with connection.cursor() as cursor:
        cursor.execute('''
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        ''')
    print("Base de datos limpia.")

if __name__ == "__main__":
    clean_database()
