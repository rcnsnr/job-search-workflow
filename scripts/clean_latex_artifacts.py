#!/usr/bin/env python3
"""Remove LaTeX build artifacts from CV/application export directories.

Keeps source .tex and final .pdf. Deletes .aux, .log, .out, .fls,
.fdb_latexmk, .synctex.gz, and any other temporary pdflatex outputs.
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPORTS = ROOT / "exports" / "applications"
ARTIFACTS = (".aux", ".log", ".out", ".fls", ".fdb_latexmk", ".synctex.gz")


def clean(directory: Path, dry_run: bool = False) -> int:
    removed = 0
    for pattern in ("*.aux", "*.log", "*.out", "*.fls", "*.fdb_latexmk", "*.synctex.gz"):
        for path in directory.rglob(pattern):
            if dry_run:
                print(f"would remove: {path.relative_to(ROOT)}")
            else:
                print(f"removing: {path.relative_to(ROOT)}")
                path.unlink()
            removed += 1
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean LaTeX build artifacts from exports/applications")
    parser.add_argument("--dry-run", action="store_true", help="List files that would be removed without deleting")
    parser.add_argument("--dir", type=Path, default=EXPORTS, help="Directory to clean (default: exports/applications)")
    args = parser.parse_args()

    target = args.dir.resolve()
    if not target.exists():
        print(f"Directory not found: {target}", file=sys.stderr)
        return 1

    removed = clean(target, dry_run=args.dry_run)
    print(f"{'Would remove' if args.dry_run else 'Removed'} {removed} artifact(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
