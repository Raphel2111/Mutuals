import os
import django
import sys

# Añadir el directorio actual al path para que los imports funcionen
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import DistributionGroup

def populate():
    group_name = "Fallas 2026"
    print(f"Iniciando recuperación del grupo: {group_name}")
    
    # Buscar o crear el grupo
    group, created = DistributionGroup.objects.get_or_create(
        name=group_name,
        defaults={
            'description': 'Grupo recuperado con todos los integrantes',
            'is_public': False
        }
    )
    
    if created:
        print(f"Se ha creado el grupo '{group_name}' porque no existía.")
    else:
        print(f"El grupo '{group_name}' ya existe. Actualizando miembros...")

    # Obtener todos los usuarios
    all_users = User.objects.all()
    user_count = all_users.count()
    
    # Añadirlos todos al grupo
    group.members.add(*all_users)
    
    # También asegurar que los staff/admins sean administradores del grupo
    staff_users = User.objects.filter(is_staff=True)
    group.admins.add(*staff_users)
    
    # Añadir específicamente al usuario 'Admin' si existe
    admin_user = User.objects.filter(username__iexact='Admin').first()
    if admin_user:
        group.admins.add(admin_user)
        group.members.add(admin_user)
        print(f"Usuario '{admin_user.username}' añadido como administrador del grupo.")
    
    print(f"Hecho: Se han añadido {user_count} usuarios como miembros.")
    print(f"Se han añadido {staff_users.count()} usuarios staff como administradores del grupo.")
    print("\n¡Listo! Ya deberías ver el grupo con todos los usuarios en la web.")

if __name__ == "__main__":
    populate()
