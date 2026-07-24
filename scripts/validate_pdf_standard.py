#!/usr/bin/env python3
"""Validate that all CV PDF files in exports/ were generated via the repo
standard export chain (LaTeX .tex source -> pdflatex -> PDF).

Enforces GAP-20260714-02: PDF/DOCX export chain hard-lock.
HTML-to-PDF tools (weasyprint, wkhtmltopdf, puppeteer, browser print) are
FORBIDDEN for CV/resume PDF generation.

Usage:
    python3 scripts/validate_pdf_standard.py
    python3 scripts/validate_pdf_standard.py --strict   # exit 1 on warnings

Exit codes:
    0 = all PDFs pass validation
    1 = one or more PDFs fail validation (missing .tex, wrong producer, etc.)
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXPORTS_DIR = REPO_ROOT / "exports"
REFERENCE_DOCX = EXPORTS_DIR / "cv-reference.docx"

# PDF producer strings that indicate FORBIDDEN HTML-to-PDF tools
FORBIDDEN_PRODUCERS = [
    "weasyprint",
    "wkhtmltopdf",
    "chromium",  # puppeteer/playwright PDF
    "chrome",    # browser print-to-PDF
    "skia",      # chrome PDF engine
    "cairo",     # some HTML-to-PDF libraries
]

# Allowed PDF producer strings (LaTeX chain)
ALLOWED_PRODUCERS = [
    "pdftex",      # pdflatex
    "tex",         # generic tex
    "latex",       # latex
    "xelatex",     # xelatex
    "lualatex",    # lualatex
]


def find_cv_pdfs(root: Path) -> list[Path]:
    """Find all PDF files under exports/applications/ that look like CVs."""
    pdfs = []
    apps_dir = root / "exports" / "applications"
    if not apps_dir.exists():
        return pdfs
    for pdf in apps_dir.rglob("*.pdf"):
        # Skip non-CV PDFs (e.g., cover letters, READMEs)
        name_lower = pdf.name.lower()
        if "cv" in name_lower or "resume" in name_lower:
            pdfs.append(pdf)
    return pdfs


def get_pdf_producer(pdf_path: Path) -> str:
    """Extract the PDF Producer field using pdfinfo or strings fallback."""
    try:
        result = subprocess.run(
            ["pdfinfo", str(pdf_path)],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if line.startswith("Producer:"):
                    return line.split(":", 1)[1].strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    # Fallback: strings + grep
    try:
        result = subprocess.run(
            ["strings", str(pdf_path)],
            capture_output=True, text=True, timeout=10
        )
        for line in result.stdout.splitlines():
            if "Producer" in line and "/" in line:
                # Extract producer from PDF metadata
                match = re.search(r'/Producer\s*\(([^)]+)\)', line)
                if match:
                    return match.group(1)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return ""


def validate_pdf(pdf_path: Path, strict: bool = False) -> list[str]:
    """Validate a single CV PDF. Returns list of error messages (empty = pass)."""
    errors = []
    warnings = []
    pdf_rel = pdf_path.relative_to(REPO_ROOT)

    # Check 1: Is there a corresponding .tex file?
    tex_path = pdf_path.with_suffix(".tex")
    if not tex_path.exists():
        # Check for .tex with same stem in same directory
        stem = pdf_path.stem
        tex_candidates = list(pdf_path.parent.glob(f"{stem}*.tex"))
        if not tex_candidates:
            errors.append(
                f"{pdf_rel}: MISSING .tex source — PDF must be generated "
                f"from LaTeX source (GAP-20260714-02). "
                f"Expected: {tex_path.name}"
            )

    # Check 2: PDF producer must be pdflatex/tex-based
    producer = get_pdf_producer(pdf_path).lower()
    if producer:
        is_forbidden = any(fp in producer for fp in FORBIDDEN_PRODUCERS)
        is_allowed = any(ap in producer for ap in ALLOWED_PRODUCERS)

        if is_forbidden:
            errors.append(
                f"{pdf_rel}: FORBIDDEN PDF producer '{producer}' — "
                f"HTML-to-PDF tools are forbidden for CV generation "
                f"(GAP-20260714-02). Must use pdflatex."
            )
        elif not is_allowed:
            warnings.append(
                f"{pdf_rel}: UNKNOWN PDF producer '{producer}' — "
                f"expected pdftex/tex-based producer. "
                f"Verify this PDF was generated via pdflatex."
            )

    # Check 3: Page size should be A4
    try:
        result = subprocess.run(
            ["pdfinfo", str(pdf_path)],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if line.startswith("Page size:"):
                    page_size = line.split(":", 1)[1].strip()
                    if "595" not in page_size and "841" not in page_size and "A4" not in page_size.upper():
                        warnings.append(
                            f"{pdf_rel}: Non-A4 page size '{page_size}' — "
                            f"repo standard is A4 (595x842 pts)."
                        )
                    break
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    if strict and warnings:
        errors.extend(warnings)
    return errors


def validate_docx_reference(strict: bool = False) -> list[str]:
    """Validate that the cv-reference.docx template exists."""
    errors = []
    if not REFERENCE_DOCX.exists():
        errors.append(
            f"MISSING reference template: {REFERENCE_DOCX.relative_to(REPO_ROOT)} — "
            f"DOCX generation requires this template (GAP-20260714-02)."
        )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate CV PDF/DOCX export chain compliance (GAP-20260714-02)"
    )
    parser.add_argument(
        "--strict", action="store_true",
        help="Exit 1 on warnings as well as errors"
    )
    args = parser.parse_args()

    all_errors = []

    # Validate PDFs
    pdfs = find_cv_pdfs(REPO_ROOT)
    if not pdfs:
        print("INFO: No CV PDFs found under exports/applications/")
    else:
        print(f"INFO: Found {len(pdfs)} CV PDF(s) to validate")
        for pdf in pdfs:
            errors = validate_pdf(pdf, strict=args.strict)
            if errors:
                all_errors.extend(errors)
                print(f"FAIL: {pdf.relative_to(REPO_ROOT)}")
                for e in errors:
                    print(f"  - {e}")
            else:
                print(f"PASS: {pdf.relative_to(REPO_ROOT)}")

    # Validate reference template
    docx_errors = validate_docx_reference(strict=args.strict)
    if docx_errors:
        all_errors.extend(docx_errors)
        for e in docx_errors:
            print(f"FAIL: {e}")

    # Summary
    print()
    if all_errors:
        print(f"RESULT: {len(all_errors)} error(s) — PDF standard validation FAILED")
        return 1
    else:
        print("RESULT: PDF standard validation PASSED")
        return 0


if __name__ == "__main__":
    sys.exit(main())
