from django.core.management.base import BaseCommand
from django.db import transaction
from events.models import Event, DistributionGroup, Registration, GroupAccessToken, GroupAccessRequest, AccessRequest, GroupInvitation, Comment
from users.models import User

class Command(BaseCommand):
    help = 'Permite limpiar la Base de Datos (Eventos, Grupos, Usuarios no-admin)'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Skip confirmation')

    def handle(self, *args, **options):
        if not options['force']:
            confirm = input("¿Estás seguro de BORRAR TODOS LOS DATOS de 'Neon'? (y/n): ")
            if confirm.lower() != 'y':
                self.stdout.write(self.style.WARNING('Cancelado.'))
                return

        with transaction.atomic():
            self.stdout.write('Borrando Eventos...')
            Event.objects.all().delete()
            
            self.stdout.write('Borrando Grupos...')
            DistributionGroup.objects.all().delete()
            
            self.stdout.write('Borrando Usuarios (excepto Staff/Superusers)...')
            count, _ = User.objects.filter(is_staff=False, is_superuser=False).delete()
            self.stdout.write(f'Usuarios borrados: {count}')
            
            self.stdout.write(self.style.SUCCESS('¡Base de datos NEON limpia como nueva! ✨'))
