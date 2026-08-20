from __future__ import annotations

import sys
from importlib import util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR_PATH = ROOT / "scripts" / "validate_pdf_standard.py"
SPEC = util.spec_from_file_location("validate_pdf_standard", VALIDATOR_PATH)
assert SPEC and SPEC.loader
validator = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validator
SPEC.loader.exec_module(validator)


def test_public_sample_cv_fixture_is_real_and_strictly_valid() -> None:
    pdf_path = validator.public_fixture_pdf(ROOT)

    assert pdf_path == ROOT / "fixtures" / "sample-cv.pdf"
    assert pdf_path.read_bytes().startswith(b"%PDF-")
    assert validator.pdf_page_count(pdf_path) == 2
    assert validator.validate_public_fixture(pdf_path, strict=True) == []
