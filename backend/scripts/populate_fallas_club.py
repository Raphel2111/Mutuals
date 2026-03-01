import os
import django
import sys

# Añadir el directorio actual al path para que los imports funcionen
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import Club, ClubMembership, Event

def populate():
    club_name = "Fallas 2026"
    print(f"Iniciando recuperación del club: {club_name}")
    
    # Buscar o crear el club
    club, created = Club.objects.get_or_create(
        name=club_name,
        defaults={
            'description': 'Club recuperado con todos los integrantes',
            'is_private': False
        }
    )
    
    if created:
        print(f"Se ha creado el club '{club_name}' porque no existía.")
    else:
        print(f"El club '{club_name}' ya existe. Actualizando miembros...")

    # Obtener todos los usuarios
    all_users = User.objects.all()
    user_count = all_users.count()
    
    # Añadirlos todos al club como miembros
    for user in all_users:
        ClubMembership.objects.get_or_create(
            user=user,
            club=club,
            defaults={'status': 'approved', 'badge': 'member'}
        )
    
    # También asegurar que los staff/admins sean administradores del club
    staff_users = User.objects.filter(is_staff=True)
    club.admins.add(*staff_users)
    
    # Añadir específicamente al usuario 'Admin' si existe
    admin_user = User.objects.filter(username__iexact='Admin').first()
    if admin_user:
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()
        club.admins.add(admin_user)
        # Ensure membership for admin
        ClubMembership.objects.get_or_create(
            user=admin_user,
            club=club,
            defaults={'status': 'approved', 'badge': 'founder'}
        )
        print(f"Usuario '{admin_user.username}' actualizado como Staff y Superuser, y añadido como admin del club.")

    # Vincular evento 'Cena FM' si existe
    cena_fm = Event.objects.filter(name__icontains="Cena FM").first()
    if cena_fm:
        cena_fm.club = club
        cena_fm.save()
        print(f"Evento '{cena_fm.name}' vinculado al club.")
    else:
        print("No se encontró el evento 'Cena FM'.")
    
    print(f"Hecho: Se han procesado {user_count} miembros.")
    print(f"Se han añadido {staff_users.count()} usuarios staff como administradores del club.")
    print("\n¡Listo! Ya deberías ver el club con todos los usuarios en la web.")

if __name__ == "__main__":
    populate()
