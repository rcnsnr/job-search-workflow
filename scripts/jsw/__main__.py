#!/usr/bin/env python3
"""Job Search Workflow CLI entry point.

Usage:
    python3 -m jsw dashboard    Start local dashboard (localhost:3000)
    python3 -m jsw init         Interactive init wizard
    python3 -m jsw smoke        Run smoke test (verify data loads)
"""

from __future__ import annotations

import sys


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "dashboard":
        run_dashboard()
    elif command == "init":
        run_init()
    elif command == "smoke":
        run_smoke()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


def run_dashboard():
    """Start the local dashboard server."""
    try:
        import uvicorn
    except ImportError:
        print("uvicorn not installed. Run: pip install uvicorn[standard]")
        sys.exit(1)

    print("Starting Job Search Workflow Dashboard on http://localhost:3000")
    print("Press Ctrl+C to stop.")
    uvicorn.run(
        "dashboard.server:app",
        host="127.0.0.1",
        port=3000,
        reload=False,
        log_level="info",
    )


def run_init():
    """Interactive init wizard — create user_data skeleton."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    user_data = root / "user_data"
    skeleton = root / "templates" / "user-data-skeleton"

    if user_data.exists() and any(user_data.iterdir()):
        print(f"user_data/ already exists at {user_data}")
        response = input("Overwrite with skeleton? (y/N): ")
        if response.lower() != "y":
            print("Init cancelled.")
            return

    user_data.mkdir(exist_ok=True)

    skeleton_dir = skeleton if skeleton.exists() else root / "templates" / "user_data"
    if not skeleton_dir.exists():
        print(f"Error: skeleton directory not found at {skeleton_dir}")
        sys.exit(1)

    for path in skeleton_dir.glob("*.md"):
        dest = user_data / path.name
        if not dest.exists():
            dest.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
            print(f"  Created: user_data/{path.name}")

    print(f"\nInit complete. Edit files in {user_data} to add your data.")
    print("Then run: python3 -m jsw dashboard")


def run_smoke():
    """Run dashboard smoke test."""
    print("Running smoke test...")
    from dashboard.server import smoke_test

    success = smoke_test()
    if success:
        print("Smoke test PASSED.")
        sys.exit(0)
    else:
        print("Smoke test FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
