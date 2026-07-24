#!/usr/bin/env python3
"""PII Scanner for job-search-workflow repository.

Scans repository files for patterns that indicate personally identifiable
information (PII) that should not be committed to a public repository.

Exit codes:
  0 - No PII detected
  1 - PII patterns found (fail-closed)

Usage:
  python3 scripts/scan_pii.py [--path PATH] [--strict]
"""

import argparse
import re
import sys
from pathlib import Path

# Patterns that indicate PII presence
PII_PATTERNS = [
    # Email addresses
    (r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "email address"),
    # Phone numbers (must start with + and country code to avoid date false positives)
    (r"\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}", "phone number"),
    # LinkedIn profile URLs (with username)
    (r"linkedin\.com/in/[a-zA-Z0-9_-]+", "LinkedIn profile URL"),
    # GitHub profile URLs (with username, excluding org/repo patterns)
    (r"github\.com/[a-zA-Z0-9_-]+(?!\.[a-z])", "GitHub profile URL"),
    # Home directory paths
    (r"/home/[a-zA-Z0-9_-]+/", "home directory path"),
    (r"/Users/[a-zA-Z0-9_-]+/", "macOS home directory path"),
]

# Paths to always skip
SKIP_PATHS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
}

# File extensions to scan
SCAN_EXTENSIONS = {
    ".md", ".txt", ".py", ".yml", ".yaml", ".json", ".toml",
    ".tex", ".sh", ".bash", ".zsh", ".env.example",
    ".html", ".css", ".js", ".ts",
}

# Files to always skip (even if extension matches)
SKIP_FILES = {
    "scan_pii.py",  # This file contains patterns, not real PII
    "package-lock.json",
    "poetry.lock",
}

# Allowlisted patterns (not real PII, just examples/placeholders)
ALLOWLIST = [
    r"your\.email@example\.com",
    r"user@example\.com",
    r"example@example\.com",
    r"email@example\.com",
    r"alex\.chen@example\.com",  # Fictitious fixture persona
    r"\+1-234-567-8900",
    r"\+1-555-0142",  # Fictitious fixture phone
    r"linkedin\.com/in/\[",
    r"linkedin\.com/in/yourprofile",
    r"linkedin\.com/in/alexchen-example",  # Fictitious fixture
    r"linkedin\.com/in/username",  # Generic placeholder in extension tests
    r"github\.com/rcnsnr/job-search-workflow",  # This repo itself
    r"github\.com/rcnsnr(?:/|$)",  # Repo owner
    r"github\.com/sponsors",  # GitHub Sponsors feature URL, not a profile
    r"github\.com/about",  # GitHub about page, not a profile
    r"github\.com/alexchen-example",  # Fictitious fixture
    r"github\.com/youruser",
    r"github\.com/\[",
    r"github\.com/search",  # GitHub search feature URL, not a profile
    r"/home/\[",
    r"rcnsnr@users\.noreply\.github\.com",  # GitHub noreply email (privacy-preserving)
]


def should_skip_path(path: Path) -> bool:
    """Check if a path should be skipped."""
    parts = path.parts
    for skip in SKIP_PATHS:
        if skip in parts:
            return True
    if path.name in SKIP_FILES:
        return True
    return False


def should_scan_file(path: Path) -> bool:
    """Check if a file should be scanned based on extension."""
    return path.suffix.lower() in SCAN_EXTENSIONS


def is_allowlisted(match: str) -> bool:
    """Check if a match is in the allowlist."""
    for pattern in ALLOWLIST:
        if re.search(pattern, match, re.IGNORECASE):
            return True
    return False


def scan_file(filepath: Path) -> list[tuple[int, str, str]]:
    """Scan a single file for PII patterns.

    Returns list of (line_number, pattern_name, matched_text).
    """
    findings = []
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except (OSError, PermissionError):
        return findings

    for line_num, line in enumerate(content.splitlines(), start=1):
        for pattern, name in PII_PATTERNS:
            for match in re.finditer(pattern, line):
                matched_text = match.group()
                if not is_allowlisted(matched_text):
                    findings.append((line_num, name, matched_text))

    return findings


def scan_directory(root: Path, strict: bool = False) -> dict[Path, list]:
    """Scan all eligible files in a directory tree."""
    all_findings: dict[Path, list] = {}

    for filepath in sorted(root.rglob("*")):
        if not filepath.is_file():
            continue
        if should_skip_path(filepath):
            continue
        if not should_scan_file(filepath):
            continue

        findings = scan_file(filepath)
        if findings:
            all_findings[filepath] = findings

    return all_findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan for PII in repository files")
    parser.add_argument(
        "--path",
        type=Path,
        default=Path("."),
        help="Root path to scan (default: current directory)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with code 1 on any finding (default behavior)",
    )
    args = parser.parse_args()

    root = args.path.resolve()
    if not root.exists():
        print(f"Error: Path does not exist: {root}", file=sys.stderr)
        return 1

    print(f"Scanning {root} for PII patterns...")
    findings = scan_directory(root)

    if not findings:
        print("PASS: No PII patterns detected.")
        return 0

    print(f"\nFAIL: PII patterns detected in {len(findings)} file(s):\n")
    total = 0
    for filepath, file_findings in findings.items():
        rel_path = filepath.relative_to(root)
        print(f"  {rel_path}:")
        for line_num, pattern_name, matched_text in file_findings:
            print(f"    L{line_num}: [{pattern_name}] {matched_text}")
            total += 1
        print()

    print(f"Total findings: {total}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
