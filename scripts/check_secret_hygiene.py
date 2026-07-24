#!/usr/bin/env python3
"""Lightweight secret hygiene scan for the job-search-workflow project."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "runs", "exports", "__pycache__"}
SKIP_SUBTREES = {".codex/locks"}
SKIP_FILES = {"scripts/check_secret_hygiene.py"}
TEXT_EXTENSIONS = {".md", ".txt", ".yaml", ".yml", ".json", ".toml", ".py", ".gitignore"}

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("private_key_block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("aws_access_key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("github_token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{36,}")),
    ("openai_token", re.compile(r"sk-(?:proj-)?[A-Za-z0-9_-]{32,}")),
    ("slack_token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}")),
]


def should_scan(path: Path) -> bool:
    rel_path = path.relative_to(ROOT)
    rel = rel_path.as_posix()
    if rel in SKIP_FILES:
        return False
    if any(rel == subtree or rel.startswith(f"{subtree}/") for subtree in SKIP_SUBTREES):
        return False
    if any(part in SKIP_DIRS for part in rel_path.parts):
        return False
    if path.name == ".gitignore":
        return True
    return path.suffix in TEXT_EXTENSIONS


def main() -> int:
    findings: list[str] = []
    for path in sorted(p for p in ROOT.rglob("*") if p.is_file() and should_scan(p)):
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        for number, line in enumerate(lines, start=1):
            for pattern_id, pattern in PATTERNS:
                if pattern.search(line):
                    findings.append(f"{path.relative_to(ROOT).as_posix()}:{number}:{pattern_id}")

    if findings:
        print("FAIL secret_hygiene")
        for finding in findings:
            print(finding)
        return 1

    print("PASS secret_hygiene")
    return 0


if __name__ == "__main__":
    sys.exit(main())
