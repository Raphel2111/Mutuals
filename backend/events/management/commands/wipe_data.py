from django.core.management.base import BaseCommand
from events.models import Event, DistributionGroup, Registration, GroupInvitation, AccessRequest, GroupAccessRequest

class Command(BaseCommand):
    help = 'Wipes all Events, Groups, and Registrations (keeps Users)'

    def handle(self, *args, **options):
        self.stdout.write("Wiping data...")
        
        # Order matters due to ForeignKey constraints
        Registration.objects.all().delete()
        GroupInvitation.objects.all().delete()
        AccessRequest.objects.all().delete()
        GroupAccessRequest.objects.all().delete()
        Event.objects.all().delete()
        DistributionGroup.objects.all().delete()
        
        self.stdout.write(self.style.SUCCESS('Successfully wiped Events, Groups, and Registrations'))
