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
from events.models import DistributionGroup
from events.serializers import DistributionGroupSerializer
from users.serializers import UserSerializer
from events.views import DistributionGroupViewSet

def debug_api():
    print("🕵️‍♂️ DEBUGGING API LOGIC 🕵️‍♂️")

    # 1. Get Group and User
    group = DistributionGroup.objects.filter(name="Fallas 2026").first()
    admin = User.objects.filter(username__iexact='Admin').first()
    
    if not group or not admin:
        print("❌ Cannot find Group or Admin user.")
        return

    print(f"Group: {group.name} (ID: {group.id})")
    print(f"User: {admin.username} (ID: {admin.id})")

    # 2. Check DB Relationships directly
    real_member_count = group.members.count()
    is_in_members = group.members.filter(id=admin.id).exists()
    print(f"DB Member Count: {real_member_count}")
    print(f"Is User in group.members? {is_in_members}")

    # 3. Simulate Serializer `is_member`
    # We need a fake request context
    factory = APIRequestFactory()
    request = factory.get('/')
    request.user = admin
    
    context = {'request': request}
    serializer = DistributionGroupSerializer(instance=group, context=context)
    data = serializer.data
    
    print("\n--- Serializer Output ---")
    print(f"is_member field: {data.get('is_member')}")
    print(f"member_count field: {data.get('member_count')}")
    
    # 4. Simulate members_list View Logic
    print("\n--- Simulating members_list Logic ---")
    members_qs = group.members.all().order_by('username')
    print(f"QuerySet Count directly: {members_qs.count()}")
    
    # Check first 5 members
    first_few = members_qs[:5]
    print(f"First 5 members in QS: {[u.username for u in first_few]}")
    
    # Serialize them
    member_serializer = UserSerializer(first_few, many=True, context=context)
    print(f"Serialized 5 members: {len(member_serializer.data)} items")
    if len(member_serializer.data) > 0:
        print(f"Sample member data: {member_serializer.data[0]['username']}")

    print("\n✅ DEBUG FINISHED")

if __name__ == "__main__":
    debug_api()
