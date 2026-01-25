from django.core.management.base import BaseCommand
from django.utils import timezone
from events.models import Event
from users.models import User
import random
from datetime import timedelta

class Command(BaseCommand):
    help = 'Genera datos de prueba (Eventos y Usuarios) para pruebas de carga'

    def handle(self, *args, **options):
        self.stdout.write('Generando datos de prueba...')
        
        # Create Dummy Admin if not exists (for ownership)
        admin_user, _ = User.objects.get_or_create(username='loadtester', email='test@load.com', defaults={'is_staff': True})
        admin_user.set_password('test1234')
        admin_user.save()

        # Create 50 events
        events_to_create = []
        for i in range(50):
            events_to_create.append(Event(
                name=f'Evento de Prueba {i}',
                description='Descripción larga para ocupar memoria ' * 10,
                date=timezone.now() + timedelta(days=random.randint(1, 30)),
                location=f'Ubicación {i}',
                capacity=1000,
                is_public=True,
                price=random.randint(0, 50)
            ))
        
        Event.objects.bulk_create(events_to_create)
        self.stdout.write(self.style.SUCCESS(f'Creados {len(events_to_create)} eventos de prueba.'))
