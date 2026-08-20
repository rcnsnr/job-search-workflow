#!/usr/bin/env python3
"""Verify that published GitHub release notes link to the upgrade guide."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


UPGRADE_GUIDE_URL = (
    "https://github.com/rcnsnr/job-search-workflow/blob/main/docs/UPGRADING.md"
)


def has_upgrade_link(release_notes: str) -> bool:
    """Return whether release notes contain the canonical upgrade-guide URL."""
    return UPGRADE_GUIDE_URL in release_notes


def release_body_from_event(event_path: Path) -> str:
    """Read the release body from a GitHub release event payload."""
    event = json.loads(event_path.read_text(encoding="utf-8"))
    release = event.get("release")
    if not isinstance(release, dict):
        raise ValueError("GitHub event payload does not contain a release object")
    body = release.get("body", "")
    if not isinstance(body, str):
        raise ValueError("GitHub release body is not text")
    return body


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Require a canonical upgrade-guide link in GitHub release notes."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--body", help="Release-note text to validate.")
    source.add_argument("--event", type=Path, help="GitHub release event JSON payload.")
    args = parser.parse_args()

    try:
        release_notes = args.body if args.body is not None else release_body_from_event(args.event)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"FAIL release notes upgrade link: {error}")
        return 2

    if not has_upgrade_link(release_notes):
        print("FAIL release notes upgrade link: missing canonical upgrade-guide URL")
        print(f"Expected: {UPGRADE_GUIDE_URL}")
        return 1

    print("PASS release notes upgrade link")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
