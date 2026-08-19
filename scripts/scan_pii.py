#!/usr/bin/env python3
"""Scan an explicit public tree for personal data and private references."""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCANNER_PATH = Path(__file__).resolve()

TEXT_EXTENSIONS = {
    ".bat",
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".py",
    ".sh",
    ".svg",
    ".tex",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}
TEXT_FILENAMES = {"CLA", "CODE_OF_CONDUCT", "CONTRIBUTING", "LICENSE"}
SKIP_DIRECTORIES = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "coverage",
    "dist",
    "htmlcov",
    "node_modules",
    "reports",
    "venv",
}
SKIP_FILES = {
    "cv-reference.docx",
    "job-search-workflow-capture-v2.0.0.zip",
    "package-lock.json",
}

EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)
ALLOWED_EMAIL_PATTERNS = (
    re.compile(r"^[^@]+@example\.(?:com|net|org)$", re.IGNORECASE),
    re.compile(r"^[^@]+@users\.noreply\.github\.com$", re.IGNORECASE),
)
DENIED_PATTERNS = (
    (re.compile(r"career" r"ops", re.IGNORECASE), "retired private product name"),
    (re.compile(r"/home/orcun/", re.IGNORECASE), "owner home directory path"),
    (re.compile(r"\bkullaniciadi\b", re.IGNORECASE), "Turkish placeholder username"),
    (re.compile(r"linkedin-job-filter", re.IGNORECASE), "old private repository slug"),
    (re.compile(r"\bBelirsiz\b", re.IGNORECASE), "untranslated Turkish fallback"),
    (re.compile(r"\bIstanbul\b", re.IGNORECASE), "owner-specific city"),
    (re.compile(r"\bTurkey\b", re.IGNORECASE), "owner-specific country"),
    (re.compile(r"\bAnkara\b", re.IGNORECASE), "owner-specific city"),
)


@dataclass(frozen=True)
class Finding:
    path: str
    line_number: int
    description: str
    line: str


def is_allowed_email(value: str) -> bool:
    return any(pattern.fullmatch(value) for pattern in ALLOWED_EMAIL_PATTERNS)


def should_scan(path: Path) -> bool:
    if path.resolve() == SCANNER_PATH:
        return False
    if path.name in SKIP_FILES:
        return False
    return path.name in TEXT_FILENAMES or path.suffix.lower() in TEXT_EXTENSIONS


def scan_line(line: str) -> list[str]:
    descriptions: list[str] = []
    if any(not is_allowed_email(match.group(0)) for match in EMAIL_PATTERN.finditer(line)):
        descriptions.append("email address")
    for pattern, description in DENIED_PATTERNS:
        if pattern.search(line):
            descriptions.append(description)
    return descriptions


def iter_files(scan_root: Path):
    if scan_root.is_file():
        if should_scan(scan_root):
            yield scan_root
        return

    for current_root, directories, filenames in os.walk(scan_root):
        directories[:] = sorted(name for name in directories if name not in SKIP_DIRECTORIES)
        root_path = Path(current_root)
        for filename in sorted(filenames):
            path = root_path / filename
            if should_scan(path):
                yield path


def scan_path(path: str | Path) -> list[Finding]:
    scan_root = Path(path).expanduser().resolve()
    if not scan_root.exists():
        raise FileNotFoundError(f"Scan path does not exist: {scan_root}")

    findings: list[Finding] = []
    for file_path in iter_files(scan_root):
        relative_path = file_path.name if scan_root.is_file() else file_path.relative_to(scan_root).as_posix()
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        for line_number, line in enumerate(lines, start=1):
            for description in scan_line(line):
                findings.append(Finding(relative_path, line_number, description, line.strip()))
    return findings


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path",
        type=Path,
        default=ROOT,
        help="File or directory to scan (default: repository root).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        findings = scan_path(args.path)
    except (FileNotFoundError, OSError) as error:
        print(f"FAIL PII scan: {error}", file=sys.stderr)
        return 2

    if findings:
        print("FAIL PII / private-reference scan found potential issues:", file=sys.stderr)
        for finding in findings:
            print(
                f"  {finding.path}:{finding.line_number}: {finding.description}: {finding.line}",
                file=sys.stderr,
            )
        return 1

    print("PASS PII / private-reference scan")
    return 0


if __name__ == "__main__":
    sys.exit(main())
