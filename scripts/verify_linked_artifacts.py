#!/usr/bin/env python3
"""Verify that inbox/jobs/ capture files contain a Linked Artifact
Verification section when the source is ATS-hosted or company-hosted.

Enforces GAP-20260719-01: Job posting linked-artifact verification (MANDATORY).
During the Playwright live snapshot of any ATS-hosted or company-hosted job
posting, the agent must enumerate hyperlinks and capture/snapshot linked pages
that describe interview process, compensation, benefits, remote-work policy,
culture, values, relocation, or visa/sponsorship rules.

This script is a CHECKLIST aid, not a pre-commit gate. Run it after capturing
a new job posting to confirm the verification section exists.

Usage:
    python3 scripts/verify_linked_artifacts.py
    python3 scripts/verify_linked_artifacts.py --file inbox/jobs/2026-07-20-zapier-applied-ai-engineer.md
    python3 scripts/verify_linked_artifacts.py --strict   # exit 1 on any missing

Exit codes:
    0 = all files pass (or --strict not set and only warnings)
    1 = one or more files missing the verification section (--strict)
"""

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
JOBS_DIR = REPO_ROOT / "inbox" / "jobs"

# source_class values that indicate an ATS-hosted or company-hosted posting
# where linked-artifact verification is mandatory.
# Excludes: linkedin, job_board, curated_indexes, newsletters, third_party boards
# (these often don't have inline linked pages about interview/benefits policy)
ATS_SOURCE_PATTERNS = [
    "ats_",
    "ashby",
    "greenhouse",
    "lever",
    "workday",
    "personio",
    "smartrecruiters",
    "official_company",
    "company_careers",
]

# Section headers that satisfy the linked-artifact verification requirement.
VERIFICATION_HEADERS = [
    "linked artifact verification",
    "linked page snapshots",
    "linked page verification",
    "linked pages",
]


def parse_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter from a markdown file."""
    fm = {}
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return fm
    for line in match.group(1).splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            fm[key.strip()] = value.strip()
    return fm


def is_ats_source(source_class: str) -> bool:
    """Check if source_class indicates an ATS-hosted or company-hosted posting."""
    if not source_class:
        return False
    sc_lower = source_class.lower()
    return any(pat in sc_lower for pat in ATS_SOURCE_PATTERNS)


def has_verification_section(content: str) -> bool:
    """Check if the file contains a linked-artifact verification section."""
    content_lower = content.lower()
    return any(header in content_lower for header in VERIFICATION_HEADERS)


def has_no_links_note(content: str) -> bool:
    """Check if the file explicitly notes that no candidate-relevant links
    were found on the posting page (acceptable when no links exist)."""
    patterns = [
        "no candidate-relevant links",
        "no linked pages",
        "no relevant links",
        "linked pages: none",
        "linked artifacts: none",
        "no inline links",
    ]
    content_lower = content.lower()
    return any(p in content_lower for p in patterns)


def verify_file(path: Path) -> dict:
    """Verify a single inbox/jobs/ file. Returns a result dict."""
    content = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(content)
    source_class = fm.get("source_class", "")
    source_url = fm.get("source_url", "")
    company = fm.get("company", "")
    role = fm.get("role_title", "")

    result = {
        "file": path.name,
        "company": company,
        "role": role,
        "source_class": source_class,
        "source_url": source_url,
        "is_ats": is_ats_source(source_class),
        "has_verification": has_verification_section(content),
        "has_no_links_note": has_no_links_note(content),
        "status": "pass",
        "message": "",
    }

    if not result["is_ats"]:
        result["status"] = "skip"
        result["message"] = "non-ATS source; linked-artifact verification not required"
        return result

    if result["has_verification"]:
        result["status"] = "pass"
        result["message"] = "linked-artifact verification section found"
    elif result["has_no_links_note"]:
        result["status"] = "pass"
        result["message"] = "explicit no-relevant-links note found"
    else:
        result["status"] = "fail"
        result["message"] = "ATS-hosted posting MISSING linked-artifact verification section"

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Verify GAP-20260719-01 linked-artifact verification in inbox/jobs/"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Verify a single file instead of scanning all inbox/jobs/",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 if any file is missing verification (default: warn only)",
    )
    args = parser.parse_args()

    if args.file:
        target = Path(args.file)
        if not target.is_absolute():
            target = REPO_ROOT / target
        if not target.exists():
            print(f"ERROR: file not found: {target}")
            sys.exit(2)
        files = [target]
    else:
        if not JOBS_DIR.exists():
            print(f"ERROR: inbox/jobs/ not found at {JOBS_DIR}")
            sys.exit(2)
        files = sorted(JOBS_DIR.glob("*.md"))

    results = [verify_file(f) for f in files]

    # Summary
    counts = {"pass": 0, "fail": 0, "skip": 0}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    print(f"=== GAP-20260719-01 Linked Artifact Verification Check ===")
    print(f"Files scanned: {len(results)}")
    print(f"  PASS (verified): {counts['pass']}")
    print(f"  FAIL (missing):  {counts['fail']}")
    print(f"  SKIP (non-ATS):  {counts['skip']}")
    print()

    # List failures
    failures = [r for r in results if r["status"] == "fail"]
    if failures:
        print(f"--- MISSING linked-artifact verification ({len(failures)} files) ---")
        for r in failures:
            print(f"  {r['file']}")
            print(f"    company: {r['company']} | role: {r['role']}")
            print(f"    source_class: {r['source_class']}")
            print(f"    source_url: {r['source_url']}")
            print()
    else:
        if counts["pass"] > 0:
            print("All ATS-hosted postings have linked-artifact verification sections.")
        else:
            print("No ATS-hosted postings found to verify.")

    # List passes for reference
    if not args.strict and counts["pass"] > 0:
        print(f"--- Verified files ({counts['pass']}) ---")
        for r in results:
            if r["status"] == "pass":
                print(f"  PASS  {r['file']}")

    if args.strict and counts["fail"] > 0:
        print(f"\nFAIL: {counts['fail']} file(s) missing linked-artifact verification.")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
