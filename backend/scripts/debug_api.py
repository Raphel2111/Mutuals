import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from users.models import User
from events.models import Club, ClubMembership
from events.serializers import ClubSerializer, UserSerializer

def debug_api():
    print("🕵️‍♂️ DEBUGGING API LOGIC 🕵️‍♂️")

    # 1. Get Club and User
    club = Club.objects.filter(name="Fallas 2026").first()
    admin = User.objects.filter(username__iexact='Admin').first() or User.objects.filter(is_superuser=True).first()
    
    if not club or not admin:
        print("❌ Cannot find Club or Admin user.")
        return

    print(f"Club: {club.name} (ID: {club.id})")
    print(f"User: {admin.username} (ID: {admin.id})")

    # 2. Check DB Relationships directly
    real_member_count = club.memberships.filter(status='approved').count()
    is_in_members = club.memberships.filter(user=admin, status='approved').exists()
    print(f"DB Approved Member Count: {real_member_count}")
    print(f"Is User in club approved members? {is_in_members}")

    # 3. Simulate Serializer `is_member` / `members_count`
    factory = APIRequestFactory()
    request = factory.get('/')
    request.user = admin
    
    context = {'request': request}
    serializer = ClubSerializer(instance=club, context=context)
    data = serializer.data
    
    print("\n--- Serializer Output ---")
    print(f"is_member field: {data.get('is_member')}")
    print(f"members_count field: {data.get('members_count')}")
    print(f"my_membership_status: {data.get('my_membership_status')}")
    
    # 4. Simulate members list view logic
    print("\n--- Simulating members list Logic ---")
    memberships_qs = club.memberships.filter(status='approved').select_related('user')
    print(f"QuerySet Count directly: {memberships_qs.count()}")
    
    # Check first few members
    first_few = memberships_qs[:5]
    print(f"First 5 members in QS: {[m.user.username for m in first_few]}")
    
    print("\n✅ DEBUG FINISHED")


if __name__ == "__main__":
    debug_api()
