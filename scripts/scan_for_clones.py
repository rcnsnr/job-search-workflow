#!/usr/bin/env python3
"""Scan GitHub for potential clones of the job-search-workflow project.

Searches GitHub code search API for unique strings from the project
(slogans, mode titles, config keys) and reports potential clones.

Usage:
    python3 scripts/scan_for_clones.py
    python3 scripts/scan_for_clones.py --token GITHUB_TOKEN
    python3 scripts/scan_for_clones.py --output reports/clone-scan.md
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "reports"

# Unique strings that are unlikely to appear in unrelated projects.
# If these appear in other repos, it's likely a clone or derivative.
SEARCH_QUERIES = [
    '"Job hunting shouldn\'t be a full-time job"',
    '"They have ATS. You have Job Search Workflow"',
    '"PolyForm Noncommercial" "job-search-workflow"',
    '"ghost_job_risk" "exploitation_risk" "chaos_risk"',
    '"opaque_normative_market" "compensation_signal"',
    '"quality_audit_recommendation" "quality_badge"',
]

GITHUB_CODE_SEARCH_API = "https://api.github.com/search/code"


def search_github_code(query: str, token: str | None = None) -> dict:
    """Search GitHub code search API."""
    url = f"{GITHUB_CODE_SEARCH_API}?q={urllib.parse.quote(query)}&per_page=10"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "JobSearchWorkflow-CloneScanner/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:200]}"}
    except Exception as e:
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Scan GitHub for potential clones")
    parser.add_argument("--token", type=str, default=os.environ.get("GITHUB_TOKEN", ""),
                        help="GitHub API token (or set GITHUB_TOKEN env var)")
    parser.add_argument("--output", type=str, default="", help="Output report file path")
    args = parser.parse_args()


    print("Scanning GitHub for potential clones of job-search-workflow...\n")

    results = []
    potential_clones = []

    for query in SEARCH_QUERIES:
        print(f"  Searching: {query[:60]}...")
        data = search_github_code(query, args.token or None)

        if "error" in data:
            print(f"    ERROR: {data['error'][:100]}")
            results.append({"query": query, "error": data["error"]})
            continue

        total = data.get("total_count", 0)
        items = data.get("items", [])
        print(f"    Found {total} results")

        # Filter out our own repo
        filtered = [
            item for item in items
            if "rcnsnr/job-search-workflow" not in item.get("repository", {}).get("full_name", "")
        ]

        if filtered:
            for item in filtered:
                repo_name = item.get("repository", {}).get("full_name", "unknown")
                html_url = item.get("html_url", "")
                potential_clones.append({
                    "query": query,
                    "repo": repo_name,
                    "url": html_url,
                })
                print(f"    POTENTIAL CLONE: {repo_name}")

        results.append({"query": query, "total_count": total, "filtered": len(filtered)})

    # Generate report
    today = date.today().isoformat()
    report_lines = [
        f"# Clone Scan Report — {today}",
        "",
        "## Summary",
        "",
        f"- Queries run: {len(SEARCH_QUERIES)}",
        f"- Potential clones found: {len(potential_clones)}",
        f"- Scan date: {today}",
        "",
        "## Query Results",
        "",
    ]

    for r in results:
        if "error" in r:
            report_lines.append(f"- `{r['query'][:50]}...`: ERROR — {r['error'][:80]}")
        else:
            report_lines.append(f"- `{r['query'][:50]}...`: {r['total_count']} total, {r['filtered']} potential clones")

    if potential_clones:
        report_lines.append("")
        report_lines.append("## Potential Clones")
        ""
        for clone in potential_clones:
            report_lines.append(f"- **{clone['repo']}** — {clone['url']}")
            report_lines.append(f"  Matched: `{clone['query'][:60]}`")
            report_lines.append("  Action: Review manually. If clone, consider:")
            report_lines.append("    - DMCA takedown notice to GitHub")
            report_lines.append("    - Contact author for license compliance")
            report_lines.append("    - Public community call-out if ignored")
            report_lines.append("")

    report_content = "\n".join(report_lines) + "\n"

    # Write report
    output_path = Path(args.output) if args.output else REPORTS_DIR / f"clone-scan-{today}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report_content, encoding="utf-8")
    print(f"\nReport saved to: {output_path}")
    print(f"Potential clones: {len(potential_clones)}")

    if potential_clones:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
