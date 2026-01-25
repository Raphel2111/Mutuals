import time
import concurrent.futures
import requests
import argparse
import statistics

def simulate_user(url):
    start_time = time.time()
    try:
        response = requests.get(url, timeout=10)
        elapsed = time.time() - start_time
        return {
            'success': 200 <= response.status_code < 300,
            'status': response.status_code,
            'time': elapsed
        }
    except Exception as e:
        return {
            'success': False,
            'status': str(e),
            'time': time.time() - start_time
        }

def run_load_test(url, users, endpoint):
    full_url = f"{url.rstrip('/')}/{endpoint.lstrip('/')}"
    print(f"🚀 Iniciando prueba de carga: {users} usuarios concurrentes contra {full_url}")
    
    start_time = time.time()
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=users) as executor:
        futures = [executor.submit(simulate_user, full_url) for _ in range(users)]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())
            
    total_time = time.time() - start_time
    
    # Analyze
    successes = [r for r in results if r['success']]
    failures = [r for r in results if not r['success']]
    times = [r['time'] for r in successes]
    
    print("\n--- 📊 RESULTADOS ---")
    print(f"Total Peticiones: {users}")
    print(f"Tiempo Total Test: {total_time:.2f}s")
    print(f"✅ Exitosas: {len(successes)}")
    print(f"❌ Fallidas: {len(failures)}")
    
    if times:
        print(f"⏱️  Latencia Media: {statistics.mean(times):.4f}s")
        print(f"⏱️  Latencia Mediana: {statistics.median(times):.4f}s")
        print(f"⏱️  Latencia Max: {max(times):.4f}s")
        print(f"⏱️  Latencia Min: {min(times):.4f}s")
        print(f"throughput: {len(successes)/total_time:.2f} req/s")
    
    if failures:
        print("\nEjemplos de errores:")
        for f in failures[:5]:
            print(f"- {f['status']} ({f['time']:.2f}s)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Stress Test Tool')
    parser.add_argument('--url', default='http://127.0.0.1:8000', help='Base API URL')
    parser.add_argument('--users', type=int, default=200, help='Number of concurrent users')
    parser.add_argument('--endpoint', default='api/events/', help='Endpoint to test')
    args = parser.parse_args()
    
    run_load_test(args.url, args.users, args.endpoint)
