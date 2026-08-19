#!/usr/bin/env python3
"""Verify career page URLs in data/career-pages/companies.yaml.

Checks HTTP status for each careers_url and optionally updates last_verified.
Flags dead links (4xx/5xx) and connection errors.

Usage:
    python3 scripts/verify_career_pages.py
    python3 scripts/verify_career_pages.py --update   # update last_verified
    python3 scripts/verify_career_pages.py --timeout 10
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
import urllib.error
from pathlib import Path
from datetime import date

import yaml

ROOT = Path(__file__).resolve().parents[1]
COMPANIES_YAML = ROOT / "data" / "career-pages" / "companies.yaml"

# ATS provider URL patterns
ATS_PATTERNS = {
    "greenhouse": ["greenhouse.io", "boards.greenhouse.io"],
    "lever": ["lever.co", "jobs.lever.co"],
    "ashby": ["ashbyhq.com"],
    "workday": ["myworkdayjobs.com", "workday.com"],
    "rippling": ["rippling.com"],
    "workable": ["workable.com"],
    "personio": ["personio.com"],
}


def detect_ats_provider(url: str) -> str:
    """Detect ATS provider from URL pattern."""
    url_lower = url.lower()
    for provider, patterns in ATS_PATTERNS.items():
        if any(p in url_lower for p in patterns):
            return provider
    return "custom"


def check_url(url: str, timeout: int = 10) -> tuple[int, str]:
    """Check URL HTTP status. Returns (status_code, error_message)."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; JobSearchWorkflow/1.0)",
                "Accept": "text/html",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, ""
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except urllib.error.URLError as e:
        return 0, str(e)
    except Exception as e:
        return 0, str(e)


def main():
    parser = argparse.ArgumentParser(description="Verify career page URLs")
    parser.add_argument("--update", action="store_true", help="Update last_verified dates")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP timeout in seconds")
    parser.add_argument("--path", type=str, default=str(COMPANIES_YAML), help="Path to companies.yaml")
    args = parser.parse_args()

    yaml_path = Path(args.path)
    if not yaml_path.exists():
        print(f"Error: {yaml_path} not found")
        sys.exit(1)

    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    companies = data.get("companies", [])
    if not companies:
        print("Error: no companies found in YAML")
        sys.exit(1)

    print(f"Verifying {len(companies)} career page URLs...\n")

    ok_count = 0
    dead_count = 0
    error_count = 0
    today = date.today().isoformat()

    for company in companies:
        name = company.get("name", "Unknown")
        url = company.get("careers_url", "")
        if not url:
            print(f"  SKIP  {name}: no URL")
            continue

        status, error = check_url(url, timeout=args.timeout)
        if status == 200:
            print(f"  OK    {name}: {status}")
            ok_count += 1
            if args.update:
                company["last_verified"] = today
        elif status >= 400:
            print(f"  DEAD  {name}: {status} {error}")
            dead_count += 1
        else:
            print(f"  ERROR {name}: {error}")
            error_count += 1

    print(f"\nResults: {ok_count} OK, {dead_count} dead, {error_count} errors")

    if args.update:
        yaml_path.write_text(
            yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )
        print(f"Updated last_verified in {yaml_path}")

    if dead_count > 0 or error_count > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
