"""
Server startup script
Launches all three servers:
1. Priority Router (port 5000)
2. Wake Detection Server (port 5001) 
3. SOS Detection Server (port 5002)
"""

import subprocess
import time
import sys
import os

def start_servers():
    print("=" * 80)
    print("Starting Whisper Audio Processing Servers")
    print("=" * 80)
    print()
    print("Architecture:")
    print("  Port 5000: Priority Router (main entry point)")
    print("  Port 5001: Wake Detection Server (lightweight, continuous)")
    print("  Port 5002: SOS Detection Server (high-priority, full accuracy)")
    print()
    print("=" * 80)
    print()

    # Start SOS server first (high priority)
    print("[1/3] Starting SOS Detection Server (port 5002)...")
    sos_proc = subprocess.Popen(
        [sys.executable, "app_sos.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    time.sleep(2)
    print("✓ SOS Server started")
    print()

    # Start Wake detection server
    print("[2/3] Starting Wake Detection Server (port 5001)...")
    wake_proc = subprocess.Popen(
        [sys.executable, "app_wake.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    time.sleep(2)
    print("✓ Wake Server started")
    print()

    # Start Priority Router
    print("[3/3] Starting Priority Router (port 5000)...")
    router_proc = subprocess.Popen(
        [sys.executable, "priority_sync.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    time.sleep(2)
    print("✓ Router started")
    print()

    print("=" * 80)
    print("All servers running!")
    print("=" * 80)
    print()
    print("API Endpoints:")
    print("  POST http://10.162.69.45:5000/transcribe?type=wake")
    print("    - For wake word detection (continuous listening)")
    print()
    print("  POST http://10.162.69.45:5000/transcribe?type=sos")
    print("    - For SOS/manual hold emergency (HIGH PRIORITY)")
    print()
    print("  GET http://10.162.69.45:5000/health")
    print("    - Check status of all servers")
    print()
    print("=" * 80)

    # Keep servers running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        sos_proc.terminate()
        wake_proc.terminate()
        router_proc.terminate()
        print("Servers stopped")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    start_servers()
