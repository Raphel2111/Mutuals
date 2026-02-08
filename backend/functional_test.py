import requests
import time
import random
import string

BACKEND_URL = "https://eventy-backend.onrender.com/api"

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def run_functional_test():
    print("Starting Functional End-to-End API Test...")
    
    # 1. Login with Pre-created Admin
    username = "functional_tester_admin"
    password = "password123"
    
    print(f"Logging in as admin: {username}")
    login_res = requests.post(f"{BACKEND_URL}/token/", json={"username": username, "password": password})
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.text}")
        return
    token = login_res.json()['access']
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Distribution Group
    print("Creating Distribution Group...")
    group_payload = {
        "name": f"Test Group {generate_random_string()}",
        "description": "Functional test group",
        "is_public": True
    }
    group_res = requests.post(f"{BACKEND_URL}/groups/", json=group_payload, headers=headers)
    if group_res.status_code != 201:
        print(f"Group creation failed: {group_res.text}")
        return
    group_id = group_res.json()['id']
    print(f"Group created with ID: {group_id}")

    # 3. Create Event in Group
    print("Creating Event...")
    event_payload = {
        "name": f"Test Event {generate_random_string()}",
        "description": "Functional test event",
        "date": "2026-12-31T20:00:00Z",
        "location": "Test Lab",
        "capacity": 50,
        "group": group_id,
        "is_public": True
    }
    event_res = requests.post(f"{BACKEND_URL}/events/", json=event_payload, headers=headers)
    if event_res.status_code != 201:
        print(f"Event creation failed: {event_res.text}")
        return
    event_id = event_res.json()['id']
    print(f"Event created with ID: {event_id}")

    # 4. Register for Event (Happy path)
    print("Registering for the event...")
    # Registration endpoint is /api/events/{id}/register/
    reg_event_res = requests.post(f"{BACKEND_URL}/events/{event_id}/register/", headers=headers)
    if reg_event_res.status_code not in [200, 201]:
        print(f"Event registration failed: {reg_event_res.text}")
        return
    reg_data = reg_event_res.json()
    qr_uuid = reg_data.get('entry_code')
    print(f"Registered successfully. QR UUID: {qr_uuid}")

    # 5. Validate QR Code
    # Assuming validation endpoint is something like /api/events/{id}/validate_qr/
    print("Validating QR Code...")
    val_res = requests.post(f"{BACKEND_URL}/events/{event_id}/validate_qr/", json={"code": qr_uuid}, headers=headers)
    if val_res.status_code == 200:
        print("QR Validation SUCCESS!")
        print(val_res.json())
    else:
        print(f"QR Validation FAILED: {val_res.text}")

    print("\n--- Functional Test SUCCESS ---")

if __name__ == "__main__":
    run_functional_test()
