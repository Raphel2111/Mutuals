import os
import django
import sys
from decimal import Decimal
from django.utils import timezone
import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from django.contrib.auth import get_user_model
from events.models import Club, Event

User = get_user_model()

def create_demo_data():
    admin, _ = User.objects.get_or_create(
        username='demo_admin_user', 
        defaults={
            'email': 'demo_admin@mutuals.app',
            'first_name': 'Admin',
            'last_name': 'Demo'
        }
    )
    admin.set_password('Mutuals2026!')
    admin.save()

    # Create a Private Paid Club
    club, created = Club.objects.get_or_create(
        slug='elite-business-club-demo',
        defaults={
            'name': 'Elite Business Club (Demo)',
            'description': 'Un club estrictamente privado y exclusivo. Requiere aprobación manual y suscripción de pago (flujo de doble validación).',
            'is_private': True,
            'monthly_price': Decimal('99.99'),
            'annual_price': Decimal('999.00'),
            'membership_benefits': '- Red de contactos top\n- Eventos secretos',
            'stripe_account_status': 'active' # Mocked for testing
        }
    )
    club.admins.add(admin)
    club.save()

    # Create an Exclusive Paid Event inside the club
    future_date = timezone.now() + datetime.timedelta(days=15)
    event, e_created = Event.objects.get_or_create(
        name='Cena de Inversores Secreta (Demo)',
        defaults={
            'description': 'Cena a puerta cerrada solo para miembros verificados del club.',
            'date': future_date,
            'location': 'Ubicación Secreta, Zona Centro',
            'is_public': False,  # Private event
            'club': club,
            'price': Decimal('150.00'),
            'capacity': 50,
            'requires_approval': True
        }
    )
    event.admins.add(admin)
    event.save()

    print("\n✅ Datos de prueba creados exitosamente!")
    print(f"🏢 Club: {club.name} (ID: {club.id})")
    print(f"🎟️ Evento: {event.name} (ID: {event.id})")
    print(f"👨‍💼 Administrador del Club: {admin.username}")

if __name__ == '__main__':
    create_demo_data()
