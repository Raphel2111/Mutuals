
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from events.models import Event, DistributionGroup, Registration, Wallet, Transaction, AccessRequest, GroupAccessToken

print("Cleaning up database...")

# Delete Operational Data
print(f"Deleting {Registration.objects.count()} registrations...")
Registration.objects.all().delete()

print(f"Deleting {Transaction.objects.count()} transactions...")
Transaction.objects.all().delete()

print(f"Deleting {Wallet.objects.count()} wallets...")
Wallet.objects.all().delete()

print(f"Deleting {AccessRequest.objects.count()} access requests...")
AccessRequest.objects.all().delete()

print(f"Deleting {GroupAccessToken.objects.count()} group tokens...")
GroupAccessToken.objects.all().delete()

# Delete Main Entities
print(f"Deleting {Event.objects.count()} events...")
Event.objects.all().delete()

print(f"Deleting {DistributionGroup.objects.count()} groups...")
DistributionGroup.objects.all().delete()

print("Cleanup complete. Users preserved.")
