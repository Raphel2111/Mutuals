
import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from events.serializers import RegistrationSerializer
from events.models import Event, Registration
from users.models import User

# Create dummy data
try:
    user = User.objects.first()
    if not user:
        print("No user found")
        exit()
    event = Event.objects.first()
    if not event:
        print("No event found")
        exit()
        
    data = {
        'status': 'declined',
        'event': event.id,
        'user': user.id # although handled by context usually
    }
    
    # Mock context with request
    from unittest.mock import Mock
    request = Mock()
    request.user = user
    # request.user.is_authenticated is a property on the real model, so it works naturally
     
    
    print(f"--- TESTING SERIALIZER WITH DATA: {data} ---")
    serializer = RegistrationSerializer(data=data, context={'request': request})
    if serializer.is_valid():
        print("VALIDATION SUCCESS")
        print(f"Validated Data keys: {serializer.validated_data.keys()}")
        print(f"Validated Status: {serializer.validated_data.get('status')}")
        
        # Test creation
        # We won't actually save to DB to avoid pollution, or maybe we do to test model save?
        # Let's trust validated_data first.
    else:
        print("VALIDATION ERROR")
        print(serializer.errors)

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
