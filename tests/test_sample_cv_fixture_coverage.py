from __future__ import annotations

import sys
from importlib import util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "check_sample_cv_fixture_coverage.py"
SPEC = util.spec_from_file_location("sample_cv_fixture_coverage", SCRIPT_PATH)
assert SPEC and SPEC.loader
coverage = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = coverage
SPEC.loader.exec_module(coverage)


def test_latex_fixture_change_requires_pdf_refresh() -> None:
    assert coverage.missing_pdf_refresh({coverage.SOURCE_PATH})
    assert not coverage.missing_pdf_refresh(
        {coverage.SOURCE_PATH, coverage.PDF_PATH}
    )


def test_unrelated_changes_do_not_require_pdf_refresh() -> None:
    assert not coverage.missing_pdf_refresh({"README.md"})
