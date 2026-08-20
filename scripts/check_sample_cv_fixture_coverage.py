#!/usr/bin/env python3
"""Require the public PDF fixture to change with its LaTeX source."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = "fixtures/sample-cv.tex"
PDF_PATH = "fixtures/sample-cv.pdf"


def missing_pdf_refresh(changed_paths: set[str]) -> bool:
    return SOURCE_PATH in changed_paths and PDF_PATH not in changed_paths


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
        description="Require the public sample CV PDF to match its LaTeX source."
    )
    parser.add_argument(
        "--base",
        required=True,
        help="Git ref to compare with HEAD, such as origin/main or a GitHub base SHA.",
    )
    args = parser.parse_args()

    if set(args.base) == {"0"}:
        print("SKIP sample CV fixture coverage: initial push has no comparison base.")
        return 0

    try:
        changed_paths = changed_paths_since(args.base)
    except subprocess.CalledProcessError as error:
        print(f"FAIL sample CV fixture coverage: cannot compare against {args.base}.")
        if error.stderr:
            print(error.stderr.strip())
        return 2

    if missing_pdf_refresh(changed_paths):
        print(f"FAIL {SOURCE_PATH} changed without refreshing {PDF_PATH}.")
        return 1

    print("PASS sample CV fixture coverage")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
