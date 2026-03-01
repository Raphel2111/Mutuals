from django.core.management.base import BaseCommand
from django.db import transaction
from events.models import (
    Event, Registration, AccessRequest, Club, ClubMembership, ClubInvitation, EmailLog,
    Wallet, Transaction
)
from users.models import User

class Command(BaseCommand):
    help = 'Limpia COMPLETAMENTE la Base de Datos (Eventos, Grupos, Entradas, Logs y Usuarios no-admin)'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Skip confirmation')

    def handle(self, *args, **options):
        if not options['force']:
            self.stdout.write(self.style.WARNING("ADVERTENCIA: Esto borrará TODO excepto los superusuarios."))
            confirm = input("¿Estás seguro de continuar? (y/n): ")
            if confirm.lower() != 'y':
                self.stdout.write(self.style.WARNING('Operación cancelada.'))
                return

        with transaction.atomic():
            self.stdout.write('Limpiando registros de eventos y entradas...')
            Registration.objects.all().delete()
            AccessRequest.objects.all().delete()
            EmailLog.objects.all().delete()
            
            self.stdout.write('Limpiando finanzas...')
            Transaction.objects.all().delete()
            Wallet.objects.all().delete()
            
            self.stdout.write('Borrando Eventos...')
            Event.objects.all().delete()
            
            self.stdout.write('Borrando Clubes y membresías...')
            ClubInvitation.objects.all().delete()
            ClubMembership.objects.all().delete()
            Club.objects.all().delete()
            
            self.stdout.write('Borrando Usuarios (excepto Staff/Superusers)...')
            count, _ = User.objects.filter(is_staff=False, is_superuser=False).delete()
            self.stdout.write(f'Usuarios borrados: {count}')
            
            self.stdout.write(self.style.SUCCESS('¡Base de datos NEON limpia como el primer día! ✨'))
            
            self.stdout.write(self.style.SUCCESS('¡Base de datos NEON limpia como nueva! ✨'))
