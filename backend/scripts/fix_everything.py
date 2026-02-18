import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import DistributionGroup, Event

def fix_all():
    print("🚀 INICIANDO REPARACIÓN TOTAL 🚀")
    
    # 1. Recuperar/Crear Grupo
    group, _ = DistributionGroup.objects.get_or_create(
        name="Fallas 2026",
        defaults={'description': 'Grupo Oficial', 'is_public': False}
    )
    print(f"✅ Grupo 'Fallas 2026' (ID: {group.id}) listo.")

    # 2. Recuperar Usuario Admin
    admin_users = User.objects.filter(username__iexact='Admin')
    if not admin_users.exists():
        print("❌ CRÍTICO: No existe usuario 'Admin'.")
        return
    
    admin = admin_users.first()
    
    # 3. Forzar Permisos Admin
    admin.is_staff = True
    admin.is_superuser = True
    admin.save()
    print(f"✅ Usuario 'Admin' (ID: {admin.id}) es Staff y Superuser.")

    # 4. Asegurar Membresía
    group.members.add(admin)
    group.admins.add(admin)
    print("✅ Usuario 'Admin' añadido a MIEMBROS y ADMINS del grupo.")

    # 5. Añadir TODOS los usuarios
    all_users = User.objects.all()
    group.members.add(*all_users)
    print(f"✅ Se han asegurado {all_users.count()} usuarios en el grupo.")

    # 6. Vincular Evento 'Cena FM' (DOBLE VINCULACIÓN)
    event = Event.objects.filter(name__icontains="Cena FM").first()
    if event:
        # Vinculación M2M (para que salga en los endpoints del grupo)
        group.events.add(event)
        
        # Vinculación ForeignKey (para que salga en los endpoints de eventos)
        event.group = group
        event.save()
        print(f"✅ Evento '{event.name}' (ID: {event.id}) totalmente vinculado (FK + M2M).")
    else:
        print("⚠️ No se encontró el evento 'Cena FM'.")

    # 7. Diagnóstico Final
    is_member = group.members.filter(id=admin.id).exists()
    print(f"🔎 COMPROBACIÓN FINAL: ¿Admin es miembro? {'SÍ' if is_member else 'NO'}")
    if is_member:
        print("🎉 REPARACIÓN COMPLETADA CON ÉXITO.")
    else:
        print("💀 ALGO SALIÓ MAL (Check DB Constraints).")

if __name__ == "__main__":
    fix_all()
