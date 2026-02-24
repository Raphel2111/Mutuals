"""
MUTUALS WebSocket Load Test
============================
Simulates N concurrent users connecting to the notification WebSocket endpoint.
Each user sends a heartbeat ping every 10 seconds.

Usage:
    python load_test_ws.py --url ws://localhost:8000 --users 100 --tokens tokens.txt
    python load_test_ws.py --url wss://your-app.onrender.com --users 50 --token eyJ...

tokens.txt: one JWT access token per line (one per simulated user)
"""
import asyncio
import argparse
import time
import json
import sys
from statistics import mean, median

try:
    import websockets
except ImportError:
    print("Install websockets first: pip install websockets")
    sys.exit(1)


async def simulate_user(url, token, user_idx, results, duration=30):
    """Simulate a single user: connect, handshake, send heartbeats, disconnect."""
    ws_url = f"{url}/ws/notifications/?token={token}"
    connect_start = time.monotonic()
    error = None

    try:
        async with websockets.connect(ws_url, open_timeout=10) as ws:
            handshake_ms = (time.monotonic() - connect_start) * 1000
            results['handshakes'].append(handshake_ms)

            end_time = time.monotonic() + duration
            pings_sent = 0
            while time.monotonic() < end_time:
                await ws.send(json.dumps({'type': 'ping'}))
                pings_sent += 1
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=3)
                    data = json.loads(msg)
                    if data.get('type') == 'pong':
                        results['pongs'] += 1
                except asyncio.TimeoutError:
                    results['timeouts'] += 1
                await asyncio.sleep(10)

    except Exception as e:
        error = str(e)
        results['errors'].append(f"User {user_idx}: {error}")

    return error is None


async def main(url, tokens, duration):
    results = {
        'handshakes': [],
        'pongs': 0,
        'timeouts': 0,
        'errors': [],
    }

    print(f"\n🚀 MUTUALS WS Load Test")
    print(f"   URL:      {url}/ws/notifications/")
    print(f"   Users:    {len(tokens)}")
    print(f"   Duration: {duration}s per user")
    print(f"\n⏳ Connecting...\n")

    tasks = [
        simulate_user(url, token, i, results, duration)
        for i, token in enumerate(tokens)
    ]

    start = time.monotonic()
    outcomes = await asyncio.gather(*tasks)
    total_time = time.monotonic() - start

    successes = sum(outcomes)
    failures  = len(outcomes) - successes

    print("\n" + "─" * 50)
    print("📊  RESULTS")
    print("─" * 50)
    print(f"  Total users simulated : {len(tokens)}")
    print(f"  Successful connections : {successes}")
    print(f"  Failed connections     : {failures}")
    print(f"  Total test duration    : {total_time:.1f}s")
    print()

    if results['handshakes']:
        print(f"  Handshake latency:")
        print(f"    avg    : {mean(results['handshakes']):.1f} ms")
        print(f"    median : {median(results['handshakes']):.1f} ms")
        print(f"    max    : {max(results['handshakes']):.1f} ms")
    print()
    print(f"  Pong responses received : {results['pongs']}")
    print(f"  Ping timeouts           : {results['timeouts']}")

    if results['errors']:
        print(f"\n❌ Errors ({len(results['errors'])}):")
        for err in results['errors'][:10]:
            print(f"    {err}")

    verdict = "✅ PASSED" if failures == 0 else f"⚠️  {failures} failures — check Redis memory on Render dashboard"
    print(f"\n{verdict}\n")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='MUTUALS WebSocket Load Test')
    parser.add_argument('--url',      default='ws://localhost:8000', help='WebSocket base URL')
    parser.add_argument('--users',    type=int, default=10,          help='Number of concurrent users')
    parser.add_argument('--duration', type=int, default=30,          help='Test duration per user (seconds)')
    parser.add_argument('--token',    default='',                    help='Single JWT token (repeats for all users)')
    parser.add_argument('--tokens',   default='',                    help='Path to file with one JWT token per line')
    args = parser.parse_args()

    tokens = []
    if args.tokens:
        with open(args.tokens) as f:
            tokens = [line.strip() for line in f if line.strip()]
    elif args.token:
        tokens = [args.token] * args.users
    else:
        print("ERROR: Provide --token <jwt> or --tokens <file>")
        sys.exit(1)

    tokens = tokens[:args.users]
    asyncio.run(main(args.url, tokens, args.duration))
