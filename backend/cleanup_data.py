
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from events.models import Event, DistributionGroup, Registration, Wallet, Transaction, AccessRequest, GroupAccessToken
from users.models import User

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

print(f"Deleting {User.objects.count()} users...")
# Delete all users EXCEPT superusers if you want to keep admin access? 
# User says "dejar virgen", implies EVERYTHING.
# But if I delete all users, they can't login.
# I will delete all. They can register again.
User.objects.all().delete()

print("Cleanup complete. ALL DATA DELETED.")
