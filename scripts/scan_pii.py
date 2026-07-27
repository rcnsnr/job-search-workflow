#!/usr/bin/env python3
"""Fail-closed PII and private-reference scanner for the public surface.

Scans public/tools/browser-extension/ and public/scripts/ for known hard-PII
and owner-specific patterns. Designed to be run in CI before any public release.

Known non-PII patterns such as generic localhost references, the Job Search Workflow
framework name, and public LinkedIn URLs are allow-listed.
"""

import os
import re
import sys

# File extensions to scan
EXTENSIONS = {".js", ".json", ".md", ".html", ".py", ".css"}

# Files and directories that are third-party or scanner artifacts and must be skipped.
SKIP_NAMES = {
    "node_modules",
    ".git",
    "__pycache__",
    ".venv",
    "package-lock.json",
    "cv-reference.docx",
}

# Patterns that are considered hard PII or private references.
# Each tuple: (pattern, description)
DENIED_PATTERNS = [
    # Email addresses (but not example/placeholder domains)
    (
        r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|net|org|io|co|me|tr|eu|gmail|yahoo|outlook|hotmail)",
        "email address",
    ),
    # Home directory paths that include the owner's username
    (r"/home/orcun/", "owner home directory path"),
    # Owner username / placeholder usernames that should not be public
    (r"\borcun\b", "owner username"),
    (r"\bkullaniciadi\b", "placeholder username in Turkish"),
    # Old private repo slug that should not appear in public
    (r"linkedin-job-filter", "old private repo slug"),
    # Old Turkish status fallback that signals untranslated private UI
    (r"\bBelirsiz\b", "untranslated Turkish fallback 'Belirsiz'"),
    # Owner-specific locations that should not be hard-coded
    (r"\bIstanbul\b", "owner city"),
    (r"\bTurkey\b", "owner country"),
    (r"\bAnkara\b", "owner-specific city"),
]

# Patterns that are allowed even if they look like a denied match.
ALLOWED_PATTERNS = [
    # Generic localhost capture server reference
    (r"localhost:\d+", "localhost capture server"),
    # Public LinkedIn URL patterns
    (r"https?://(www\.)?linkedin\.com", "public LinkedIn URL"),
    # Job Search Workflow framework name is public
    (r"Job Search Workflow", "Job Search Workflow framework name"),
    # Job Search Workflow Capture public name
    (r"Job Search Workflow Capture", "public product name"),
    # job-search-workflow-capture slug
    (r"job-search-workflow-capture", "public repo slug"),
    # Generic placeholder username
    (r"<your-username>", "placeholder username"),
    # Example / placeholder domains
    (r"@example\.", "example domain"),
    (r"example\.com", "example domain"),
]


def should_skip(path: str) -> bool:
    for part in path.split(os.sep):
        if part in SKIP_NAMES:
            return True
    return False


def is_allowed(line: str) -> bool:
    for pattern, _ in ALLOWED_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def scan_file(path: str) -> list[tuple[int, str, str]]:
    findings = []
    with open(path, encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            if is_allowed(line):
                continue
            for pattern, description in DENIED_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append((line_number, description, line.strip()))
                    break
    return findings


def main() -> int:
    base_dir = os.path.dirname(__file__)
    repo_dir = os.path.abspath(os.path.join(base_dir, ".."))
    scan_dirs = [
        os.path.join(repo_dir, "tools", "browser-extension"),
        os.path.join(repo_dir, "scripts"),
    ]
    scanner_path = os.path.abspath(__file__)

    all_findings: list[tuple[str, int, str, str]] = []

    for scan_dir in scan_dirs:
        if not os.path.isdir(scan_dir):
            continue
        for root, _, files in os.walk(scan_dir):
            for filename in files:
                full_path = os.path.join(root, filename)
                if os.path.abspath(full_path) == scanner_path:
                    # Do not scan the scanner itself for its own regex strings.
                    continue
                if should_skip(full_path):
                    continue
                ext = os.path.splitext(filename)[1].lower()
                if ext not in EXTENSIONS:
                    continue
                filepath = os.path.relpath(full_path, repo_dir)
                for line_number, description, line in scan_file(full_path):
                    all_findings.append((filepath, line_number, description, line))

    if all_findings:
        print("❌ PII / private-reference scan found potential issues:", file=sys.stderr)
        for filepath, line_number, description, line in all_findings:
            print(f"  {filepath}:{line_number}: {description}: {line}", file=sys.stderr)
        return 1

    print("✅ PII / private-reference scan passed. No hard PII or owner-specific patterns found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
