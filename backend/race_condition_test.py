import requests
import concurrent.futures
import time
import sys

BACKEND_URL = "https://eventy-backend.onrender.com/api"

def register_user(username, password):
    payload = {
        "username": username,
        "email": f"{username}@test.com",
        "password": password,
        "password_confirm": password,
        "first_name": "Race",
        "last_name": "Tester"
    }
    response = requests.post(f"{BACKEND_URL}/users/register/", json=payload)
    if response.status_code == 201:
        print(f"User {username} registered successfully.")
        return True
    else:
        print(f"Registration failed: {response.status_code} - {response.text}")
        return True

def get_auth_token(username, password):
    response = requests.post(f"{BACKEND_URL}/token/", json={
        "username": username,
        "password": password
    })
    if response.status_code == 200:
        return response.json()["access"]
    else:
        print(f"Failed to get token: {response.status_code} - {response.text}")
        return None

def send_registration(token, event_id, index):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "event": event_id,
        "status": "confirmed"
    }
    start_time = time.time()
    try:
        response = requests.post(f"{BACKEND_URL}/registrations/", json=payload, headers=headers, timeout=30)
        return {
            "index": index,
            "status": response.status_code,
            "text": response.text,
            "duration": time.time() - start_time
        }
    except Exception as e:
        return {"index": index, "status": "EXCEPTION", "text": str(e), "duration": time.time() - start_time}

def test_race_condition(username, password, event_id=None, concurrency=3):
    register_user(username, password)
    token = get_auth_token(username, password)
    if not token:
        return

    if not event_id:
        # Get first event
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(f"{BACKEND_URL}/events/", headers=headers)
        events = res.json()
        items = events if isinstance(events, list) else events.get('results', [])
        if not items:
            print("No events found to test.")
            return
        event_id = items[0]['id']
        print(f"Auto-selected Event ID: {event_id} ({items[0]['name']})")

    print(f"Starting Race Condition Test for User: {username}, Event: {event_id}")
    print(f"Simulating {concurrency} rapid clicks...")
    print("-" * 50)

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(send_registration, token, event_id, i) for i in range(concurrency)]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    success_count = sum(1 for r in results if r["status"] == 201)
    error_count = sum(1 for r in results if r["status"] != 201)
    
    print("\n" + "="*50)
    print("      RESULTS")
    print("="*50)
    print(f"Success (201): {success_count}")
    print(f"Errors:        {error_count}")
    
    if success_count > 1:
        print("FAILED: Duplicates created.")
    elif success_count == 1:
        print("PASSED: Unique constraint working.")
    else:
        print("NO SUCCESSFUL REGISTRATIONS. Check below for errors.")

    for r in results:
        print(f"Req {r['index']}: {r['status']} - {r['text'][:100]}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python race_condition_test.py <username> <password> [event_id]")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    event_id = int(sys.argv[3]) if len(sys.argv) > 3 else None
    
    test_race_condition(username, password, event_id)
