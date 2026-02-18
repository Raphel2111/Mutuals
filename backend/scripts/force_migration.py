import os
import django
import sys
from django.db import connection

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

def force_remove_constraint():
    print("🛠️ FORZANDO ELIMINACIÓN DE RESTRICCIÓN DE UNICIDAD 🛠️")
    
    with connection.cursor() as cursor:
        # Check if constraint exists
        cursor.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'events_registration' 
            AND constraint_type = 'UNIQUE';
        """)
        constraints = cursor.fetchall()
        print(f"Restricciones encontradas: {constraints}")
        
        # Try to drop the specific constraint 'unique_personal_registration'
        # Note: In SQLite, dropping constraints is hard (requires table recreation).
        # But maybe we are on Postgres in Render? The error message looked like Postgres.
        # "duplicate key value violates unique constraint" is typical Postgres.
        
        try:
            cursor.execute("ALTER TABLE events_registration DROP CONSTRAINT unique_personal_registration;")
            print("✅ Restricción 'unique_personal_registration' ELIMINADA.")
        except Exception as e:
            print(f"⚠️ No se pudo eliminar por nombre directo: {e}")
            
            # Fallback: Try dropping by index if it exists (for SQLite/Postgres variance)
            try:
                cursor.execute("DROP INDEX IF EXISTS unique_personal_registration;")
                print("✅ Índice 'unique_personal_registration' ELIMINADO.")
            except Exception as e2:
                print(f"⚠️ Falló el borrado de índice: {e2}")

    print("🏁 Intento de desbloqueo finalizado.")

if __name__ == "__main__":
    force_remove_constraint()
