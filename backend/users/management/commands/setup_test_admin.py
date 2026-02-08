from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = 'Creates or promotes a test admin user'

    def handle(self, *args, **options):
        User = get_user_model()
        username = "functional_tester_admin"
        email = "admin@tester.com"
        password = "password123"
        
        user, created = User.objects.get_or_create(username=username, defaults={'email': email})
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.save()
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created test admin "{username}"'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Updated test admin "{username}"'))
