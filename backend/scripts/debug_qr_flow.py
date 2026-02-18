import os
import django
import sys
import uuid

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import Event, Registration
from events.serializers import RegistrationSerializer

def debug_qr_flow():
    print("🕵️‍♂️ DEBUGGING QR FLOW 🕵️‍♂️")
    
    # 1. Fetch Event
    event = Event.objects.filter(name__icontains="Cena FM").first()
    print(f"Event: {event.name} (ID: {event.id})")
    
    # 2. Inspect last 5 registrations
    print("\n--- Last 5 Registrations ---")
    last_regs = Registration.objects.filter(event=event).order_by('-created_at')[:5]
    for reg in last_regs:
        print(f"User: {reg.user.username}, EntryCode: {reg.entry_code} (Type: {type(reg.entry_code)})")
        
    # 3. Simulate New Creation
    print("\n--- Creating Test Registration ---")
    dummy_user, _ = User.objects.get_or_create(username="DebugUser", defaults={'email': 'debug@test.com'})
    
    # Clean up previous debug reg
    Registration.objects.filter(user=dummy_user, event=event).delete()
    
    new_reg = Registration.objects.create(
        user=dummy_user,
        event=event,
        status='confirmed'
    )
    print(f"Created Reg ID: {new_reg.id}")
    print(f"Generic Code: {new_reg.entry_code}")
    print(f"QR Image: {new_reg.qr_code}")
    
    # 4. Simulate Validation
    qr_content = str(new_reg.entry_code)
    print(f"\nScanning QR Content: '{qr_content}'")
    
    # Logic from verified view
    reg_found = None
    reg_qs = Registration.objects.filter(entry_code=qr_content)
    if reg_qs.exists():
        print("✅ Direct Match Success!")
        reg_found = reg_qs.first()
    else:
        print("❌ Direct Match FAILED.")
        
    if not reg_found:
        print("Attempting Fallback Logic...")
        try:
            parts = qr_content.split('/')
            possible_id = parts[-1]
            print(f"Parsed ID: '{possible_id}'")
            uuid_obj = uuid.UUID(possible_id)
            print(f"UUID Object: {uuid_obj}")
            reg_qs = Registration.objects.filter(entry_code=possible_id)
            if reg_qs.exists():
                print("✅ Fallback Match Success!")
            else:
                 print("❌ Fallback Match FAILED.")
        except Exception as e:
            print(f"❌ Exception in fallback: {e}")

if __name__ == "__main__":
    debug_qr_flow()
