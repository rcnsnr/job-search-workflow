#!/usr/bin/env python3
"""Job Search Workflow CLI entry point.

Usage:
    python3 -m jsw dashboard    Start local dashboard (localhost:3000)
    python3 -m jsw init         Interactive init wizard
    python3 -m jsw smoke        Run smoke test (verify data loads)
"""

from __future__ import annotations

import os
import sys


DEFAULT_USER_FILES = {
    "career_profile.md": "# Career Profile\n\nReplace this text with verified career information.\n",
    "skill_matrix_summary.md": "# Skill Matrix Summary\n\nList verified skills and evidence here.\n",
    "target_roles.md": (
        "# Career Direction\n\n"
        "## Target roles\n\n- Add the roles you want to pursue.\n\n"
        "## Decision criteria\n\n"
        "### Must have\n\n- Add non-negotiable requirements.\n\n"
        "### Prefer\n\n- Add positive signals and trade-offs.\n\n"
        "### Avoid\n\n- Add boundaries that should stop an application.\n"
    ),
}


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

    print("Starting Job Search Workflow Community Edition on http://localhost:3000")
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

    root = Path(os.environ.get("JSW_WORKSPACE", Path.cwd())).expanduser().resolve()
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
    source_files = (
        {path.name: path.read_text(encoding="utf-8") for path in skeleton_dir.glob("*.md")}
        if skeleton_dir.exists()
        else DEFAULT_USER_FILES
    )

    for filename, content in source_files.items():
        dest = user_data / filename
        if not dest.exists():
            dest.write_text(content, encoding="utf-8")
            print(f"  Created: user_data/{filename}")

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
