#!/usr/bin/env python3
"""Require stable public screenshots when dashboard visuals change."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STABLE_SCREENSHOTS = (
    "assets/screenshots/dashboard-overview.png",
    "assets/screenshots/dashboard-pipeline.png",
    "assets/screenshots/dashboard-jobs.png",
    "assets/screenshots/dashboard-profile.png",
    "assets/screenshots/dashboard-scoring.png",
)
VISUAL_SOURCE_PREFIXES = (
    "dashboard/static/",
    "dashboard/templates/",
)
VISUAL_SOURCE_FILES = {"dashboard/server.py"}


def has_visual_dashboard_change(changed_paths: set[str]) -> bool:
    return any(
        path in VISUAL_SOURCE_FILES
        or path.startswith(VISUAL_SOURCE_PREFIXES)
        for path in changed_paths
    )


def missing_screenshot_updates(changed_paths: set[str]) -> set[str]:
    if not has_visual_dashboard_change(changed_paths):
        return set()
    return set(STABLE_SCREENSHOTS) - changed_paths


def changed_paths_since(base_ref: str) -> set[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
        check=True,
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return {line for line in result.stdout.splitlines() if line}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Require stable screenshots for public dashboard visual changes."
    )
    parser.add_argument(
        "--base",
        required=True,
        help="Git ref to compare with HEAD, such as origin/main or a GitHub base SHA.",
    )
    args = parser.parse_args()

    if set(args.base) == {"0"}:
        print("SKIP dashboard screenshot coverage: initial push has no comparison base.")
        return 0

    try:
        changed_paths = changed_paths_since(args.base)
    except subprocess.CalledProcessError as error:
        print(f"FAIL dashboard screenshot coverage: cannot compare against {args.base}.")
        if error.stderr:
            print(error.stderr.strip())
        return 2

    missing = missing_screenshot_updates(changed_paths)
    if not missing:
        print("PASS dashboard screenshot coverage")
        return 0

    print("FAIL dashboard visual sources changed without all stable screenshots:")
    for path in sorted(missing):
        print(f"- {path}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
