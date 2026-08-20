#!/usr/bin/env python3
"""Require stable public screenshots when dashboard visuals change."""

from __future__ import annotations

import argparse
import re
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
CAPTURE_RECEIPT = "assets/screenshots/manifest.json"
VISUAL_SOURCE_PREFIXES = (
    "dashboard/static/",
    "dashboard/templates/",
)
VISUAL_SOURCE_FILES = {"dashboard/server.py"}
SERVER_VERSION_CHANGE = re.compile(r'^[+-]\s*version="[^"]+",$')


def server_diff_is_metadata_only(diff: str) -> bool:
    """Allow a FastAPI version-only bump without requiring new screenshots."""
    changed_lines = [
        line
        for line in diff.splitlines()
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))
    ]
    return bool(changed_lines) and all(SERVER_VERSION_CHANGE.fullmatch(line) for line in changed_lines)


def has_visual_dashboard_change(
    changed_paths: set[str], *, server_change_is_metadata_only: bool = False
) -> bool:
    """Return whether changed paths can alter dashboard screenshots."""
    return any(
        (path in VISUAL_SOURCE_FILES and not server_change_is_metadata_only)
        or path.startswith(VISUAL_SOURCE_PREFIXES)
        for path in changed_paths
    )


def missing_screenshot_updates(
    changed_paths: set[str], *, server_change_is_metadata_only: bool = False
) -> set[str]:
    if not has_visual_dashboard_change(
        changed_paths, server_change_is_metadata_only=server_change_is_metadata_only
    ):
        return set()
    if CAPTURE_RECEIPT in changed_paths:
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


def server_diff_since(base_ref: str) -> str:
    """Return the zero-context diff for the dashboard server."""
    result = subprocess.run(
        ["git", "diff", "--unified=0", f"{base_ref}...HEAD", "--", "dashboard/server.py"],
        check=True,
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return result.stdout


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

    metadata_only = (
        "dashboard/server.py" in changed_paths
        and server_diff_is_metadata_only(server_diff_since(args.base))
    )
    missing = missing_screenshot_updates(
        changed_paths, server_change_is_metadata_only=metadata_only
    )
    if not missing:
        print("PASS dashboard screenshot coverage")
        return 0

    print("FAIL dashboard visual sources changed without all stable screenshots:")
    for path in sorted(missing):
        print(f"- {path}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
