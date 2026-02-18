import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import DistributionGroup, Event

def check_status():
    print("--- DIAGNÓSTICO DE GRUPO Y USUARIO ---")
    
    # 1. Check User 'Admin'
    admin_user = User.objects.filter(username__iexact='Admin').first()
    if not admin_user:
        print("❌ Error: Usuario 'Admin' NO encontrado.")
        return
    else:
        print(f"✅ Usuario encontrado: ID={admin_user.id}, Username={admin_user.username}")
        print(f"   Details: is_staff={admin_user.is_staff}, is_superuser={admin_user.is_superuser}")

    # 2. Check Group 'Fallas 2026'
    group = DistributionGroup.objects.filter(name="Fallas 2026").first()
    if not group:
        print("❌ Error: Grupo 'Fallas 2026' NO encontrado.")
        return
    else:
        print(f"✅ Grupo encontrado: ID={group.id}, Name={group.name}")
        print(f"   Member Count (DB): {group.members.count()}")
        print(f"   Admin Count (DB): {group.admins.count()}")

    # 3. Check Membership
    is_member = group.members.filter(id=admin_user.id).exists()
    is_group_admin = group.admins.filter(id=admin_user.id).exists()
    
    if is_member:
        print("✅ INTEGRIDAD: El usuario 'Admin' ESTÁ en group.members")
    else:
        print("❌ INTEGRIDAD: El usuario 'Admin' NO ESTÁ en group.members (Esto causa el problema)")

    if is_group_admin:
        print("✅ INTEGRIDAD: El usuario 'Admin' ESTÁ en group.admins")
    else:
        print("⚠️ INTEGRIDAD: El usuario 'Admin' NO ESTÁ en group.admins")
        
    # 4. Check Event 'Cena FM'
    event = Event.objects.filter(name__icontains="Cena FM").first()
    if event:
        print(f"✅ Evento 'Cena FM' encontrado: ID={event.id}")
        if group.events.filter(id=event.id).exists():
             print("✅ Evento VINCULADO correctamente al grupo.")
        else:
             print("❌ Evento NO VINCULADO al grupo.")
    else:
        print("⚠️ Evento 'Cena FM' no encontrado.")

if __name__ == "__main__":
    check_status()
