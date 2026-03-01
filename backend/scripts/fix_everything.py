import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import Club, Event, ClubMembership
from django.utils import timezone

def fix_all():
    print("🚀 INICIANDO REPARACIÓN TOTAL 🚀")
    
    # 1. Recuperar/Crear Club
    club, _ = Club.objects.get_or_create(
        name="Fallas 2026",
        defaults={'description': 'Club Oficial', 'is_private': False, 'slug': 'fallas-2026'}
    )
    print(f"✅ Club 'Fallas 2026' (ID: {club.id}) listo.")

    # 2. Recuperar Usuario Admin
    admin_users = User.objects.filter(username__iexact='Admin')
    if not admin_users.exists():
        admin = User.objects.filter(is_superuser=True).first()
        if not admin:
            print("❌ CRÍTICO: No existe usuario 'Admin' ni superusuario.")
            return
    else:
        admin = admin_users.first()
    
    # 3. Forzar Permisos Admin
    admin.is_staff = True
    admin.is_superuser = True
    admin.save()
    print(f"✅ Usuario '{admin.username}' (ID: {admin.id}) es Staff y Superuser.")

    # 4. Asegurar Membresía
    ClubMembership.objects.get_or_create(
        user=admin, club=club,
        defaults={'status': 'approved', 'badge': 'founder', 'joined_at': timezone.now()}
    )
    club.admins.add(admin)
    print(f"✅ Usuario '{admin.username}' añadido a MIEMBROS y ADMINS del club.")

    # 5. Añadir TODOS los usuarios (opcional, pero para paridad con legacy)
    all_users = User.objects.all()
    for user in all_users:
        ClubMembership.objects.get_or_create(
            user=user, club=club,
            defaults={'status': 'approved', 'badge': 'member', 'joined_at': timezone.now()}
        )
    print(f"✅ Se han asegurado {all_users.count()} usuarios en el club.")

    # 6. Vincular Eventos
    events = Event.objects.filter(name__icontains="Cena FM")
    for event in events:
        event.club = club
        event.save()
        print(f"✅ Evento '{event.name}' (ID: {event.id}) vinculado al club.")

    # 7. Diagnóstico Final
    is_member = ClubMembership.objects.filter(club=club, user=admin, status='approved').exists()
    print(f"🔎 COMPROBACIÓN FINAL: ¿Admin es miembro aprobado? {'SÍ' if is_member else 'NO'}")
    if is_member:
        print("🎉 REPARACIÓN COMPLETADA CON ÉXITO.")
    else:
        print("💀 ALGO SALIÓ MAL (Check DB Constraints).")


if __name__ == "__main__":
    fix_all()
