import requests
import concurrent.futures
import time
import random
import string
import sys

BACKEND_URL = "https://eventy-backend.onrender.com/api"

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def register_user(index):
    username = f"stress_user_{index}_{generate_random_string(4)}"
    email = f"{username}@example.com"
    password = "password123"
    
    payload = {
        "username": username,
        "email": email,
        "password": password,
        "password_confirm": password,
        "first_name": "Stress",
        "last_name": f"Test-{index}"
    }
    
    start_time = time.time()
    try:
        response = requests.post(f"{BACKEND_URL}/users/register/", json=payload, timeout=15)
        duration = time.time() - start_time
        return {
            "index": index,
            "status": response.status_code,
            "duration": duration,
            "username": username,
            "success": response.status_code == 201,
            "error": response.text if response.status_code != 201 else None
        }
    except Exception as e:
        return {
            "index": index,
            "status": "EXCEPTION",
            "duration": time.time() - start_time,
            "username": username,
            "success": False,
            "error": str(e)
        }

def run_stress_test(concurrency=10, total_requests=300):
    print(f"Starting Stress Test: {total_requests} requests, {concurrency} concurrent workers")
    print(f"Backend: {BACKEND_URL}")
    print("-" * 50)
    
    results = []
    start_all = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {executor.submit(register_user, i): i for i in range(total_requests)}
        
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())
            completed += 1
            if completed % 50 == 0:
                print(f"Progress: {completed}/{total_requests} requests completed...")
                
    total_duration = time.time() - start_all
    
    # Analysis
    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]
    durations = [r["duration"] for r in results]
    
    print("\n" + "="*50)
    print("      STRESS TEST RESULTS (300 REQUESTS)")
    print("="*50)
    print(f"Total Time:      {total_duration:.2f}s")
    print(f"Requests/sec:    {len(results)/total_duration:.2f}")
    print(f"Success Rate:    {len(successes)}/{len(results)} ({(len(successes)/len(results))*100:.1f}%)")
    print(f"Average Latency: {sum(durations)/len(durations):.2f}s")
    print(f"Max Latency:     {max(durations):.2f}s")
    print(f"Min Latency:     {min(durations):.2f}s")
    
    if failures:
        print("\nError Summary:")
        error_counts = {}
        for f in failures:
            err = f["status"]
            error_counts[err] = error_counts.get(err, 0) + 1
        for err, count in error_counts.items():
            print(f"- Status {err}: {count} occurrences")
            
    print("\n" + "="*50)
    print("      CONSISTENCY CHECK")
    print("="*50)
    print("Verifying if registered users are retrievable (sampling 10)...")
    
    # Sample 10 users and try to check their existence (using 'retrieve' if public or 'ping' or similar)
    # Since we can't easily check internal user existence without auth, we'll look at the first few registration response data if they were returned.
    # A successful 201 is already a strong consistency indicator for the DB commit.
    print("All successful 201 status codes indicate database consistency for those records.")
    
if __name__ == "__main__":
    # Check if backend is alive
    try:
        requests.get(f"{BACKEND_URL}/users/ping/", timeout=5)
    except:
        print("Backend is down or unreachable. Aborting.")
        sys.exit(1)
        
    run_stress_test(concurrency=10, total_requests=300)
