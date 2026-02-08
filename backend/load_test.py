import requests
import concurrent.futures
import time
import random
import string

BACKEND_URL = "https://eventy-backend.onrender.com/api"

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def register_user():
    username = f"user_{generate_random_string()}"
    email = f"{username}@example.com"
    password = "password123"
    
    payload = {
        "username": username,
        "email": email,
        "password": password,
        "password_confirm": password,
        "first_name": "Test",
        "last_name": "User"
    }
    
    start_time = time.time()
    try:
        response = requests.post(f"{BACKEND_URL}/users/register/", json=payload, timeout=10)
        duration = time.time() - start_time
        return response.status_code, duration
    except Exception as e:
        return str(e), time.time() - start_time

def run_load_test(concurrency=10, total_requests=50):
    print(f"Starting load test with {concurrency} concurrent workers, total {total_requests} requests...")
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(register_user) for _ in range(total_requests)]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())
            
    # Analyze results
    success_count = sum(1 for status, _ in results if status == 201)
    durations = [duration for _, duration in results if isinstance(_, (int, float))]
    
    print("\n--- Load Test Results ---")
    print(f"Total Requests: {total_requests}")
    print(f"Success (201 Created): {success_count}")
    print(f"Failures: {total_requests - success_count}")
    
    if durations:
        print(f"Average Request Time: {sum(durations) / len(durations):.2f}s")
        print(f"Max Request Time: {max(durations):.2f}s")
        print(f"Min Request Time: {min(durations):.2f}s")
    
    # Print error summary if any
    errors = {}
    for status, _ in results:
        if status != 201:
            errors[status] = errors.get(status, 0) + 1
    
    if errors:
        print("\nError Summary:")
        for status, count in errors.items():
            print(f"Status {status}: {count}")

if __name__ == "__main__":
    # First, test connection
    try:
        ping_res = requests.get(f"{BACKEND_URL}/users/ping/")
        print(f"Ping result: {ping_res.status_code} - {ping_res.json()}")
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        exit(1)
        
    run_load_test(concurrency=5, total_requests=20)
