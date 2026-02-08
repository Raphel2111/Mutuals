import requests
import concurrent.futures
import time
import random
import string

BACKEND_URL = "https://eventy-backend.onrender.com/api"

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def register_and_login_user():
    username = f"user_{generate_random_string()}"
    email = f"{username}@example.com"
    password = "password123"
    
    # Payload for registration
    reg_payload = {
        "username": username,
        "email": email,
        "password": password,
        "password_confirm": password,
        "first_name": "Test",
        "last_name": "User"
    }
    
    results = {}
    
    # Test Registration
    start_time = time.time()
    try:
        reg_res = requests.post(f"{BACKEND_URL}/users/register/", json=reg_payload, timeout=15)
        results['registration'] = (reg_res.status_code, time.time() - start_time)
    except Exception as e:
        results['registration'] = (str(e), time.time() - start_time)
        return results # Stop if registration fails

    if reg_res.status_code == 201:
        # Test Login (Get Token)
        login_payload = {"username": username, "password": password}
        start_time = time.time()
        try:
            login_res = requests.post(f"{BACKEND_URL}/token/", json=login_payload, timeout=15)
            results['login'] = (login_res.status_code, time.time() - start_time)
        except Exception as e:
            results['login'] = (str(e), time.time() - start_time)
            
    return results

def run_load_test(concurrency=5, total_requests=15):
    print(f"Starting load test with {concurrency} concurrent workers, total {total_requests} full flows (Reg + Login)...")
    all_results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(register_and_login_user) for _ in range(total_requests)]
        for future in concurrent.futures.as_completed(futures):
            all_results.append(future.result())
            
    # Analyze results
    reg_success = sum(1 for r in all_results if r.get('registration', (0,0))[0] == 201)
    login_success = sum(1 for r in all_results if r.get('login', (0,0))[0] == 200)
    
    reg_durations = [r['registration'][1] for r in all_results if 'registration' in r and isinstance(r['registration'][1], (int, float))]
    login_durations = [r['login'][1] for r in all_results if 'login' in r and isinstance(r['login'][1], (int, float))]
    
    print("\n--- Load Test Results ---")
    print(f"Total Flows Attempted: {total_requests}")
    print(f"Registration Success: {reg_success}/{total_requests}")
    print(f"Login Success: {login_success}/{reg_success}")
    
    if reg_durations:
        print(f"Avg Reg Time: {sum(reg_durations) / len(reg_durations):.2f}s")
    if login_durations:
        print(f"Avg Login Time: {sum(login_durations) / len(login_durations):.2f}s")

if __name__ == "__main__":
    # First, test connection
    try:
        ping_res = requests.get(f"{BACKEND_URL}/users/ping/")
        print(f"Ping result: {ping_res.status_code} - {ping_res.json()}")
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        exit(1)
        
    run_load_test(concurrency=5, total_requests=20)
