import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import Club, Event, ClubMembership

def check_status():
    print("--- DIAGNÓSTICO DE CLUB Y USUARIO ---")
    
    # 1. Check User 'Admin'
    admin_user = User.objects.filter(username__iexact='Admin').first() or User.objects.filter(is_superuser=True).first()
    if not admin_user:
        print("❌ Error: Usuario 'Admin' o superusuario NO encontrado.")
        return
    else:
        print(f"✅ Usuario encontrado: ID={admin_user.id}, Username={admin_user.username}")
        print(f"   Details: is_staff={admin_user.is_staff}, is_superuser={admin_user.is_superuser}")

    # 2. Check Club 'Fallas 2026'
    club = Club.objects.filter(name="Fallas 2026").first()
    if not club:
        print("❌ Error: Club 'Fallas 2026' NO encontrado.")
        return
    else:
        print(f"✅ Club encontrado: ID={club.id}, Name={club.name}")
        print(f"   Approved Members: {club.memberships.filter(status='approved').count()}")
        print(f"   Admin Count: {club.admins.count()}")

    # 3. Check Membership
    is_member = club.memberships.filter(user=admin_user, status='approved').exists()
    is_club_admin = club.admins.filter(id=admin_user.id).exists()
    
    if is_member:
        print("✅ INTEGRIDAD: El usuario ESTÁ como miembro aprobado")
    else:
        print("❌ INTEGRIDAD: El usuario NO ESTÁ como miembro aprobado")

    if is_club_admin:
        print("✅ INTEGRIDAD: El usuario ES admin del club")
    else:
        print("⚠️ INTEGRIDAD: El usuario NO ES admin del club")
        
    # 4. Check Event 'Cena FM'
    event = Event.objects.filter(name__icontains="Cena FM").first()
    if event:
        print(f"✅ Evento 'Cena FM' encontrado: ID={event.id}")
        if event.club == club:
             print("✅ Evento VINCULADO correctamente al club.")
        else:
             print("❌ Evento NO VINCULADO al club.")
    else:
        print("⚠️ Evento 'Cena FM' no encontrado.")


if __name__ == "__main__":
    check_status()
