from __future__ import annotations

import sys
from importlib import util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = ROOT / "scripts" / "verify_no_turkish.py"
SPEC = util.spec_from_file_location("verify_no_turkish", CHECKER_PATH)
assert SPEC and SPEC.loader
verify_no_turkish = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = verify_no_turkish
SPEC.loader.exec_module(verify_no_turkish)


def test_additional_allowlist_suppresses_configured_word() -> None:
    findings: list[str] = []
    candidate = "bas" + "vuru"
    allowed = verify_no_turkish.ALLOWED | {candidate}

    verify_no_turkish.check_line(
        candidate,
        Path("fixture.md"),
        1,
        findings,
        allowed,
    )

    assert findings == []


def test_word_is_reported_without_additional_allowlist() -> None:
    findings: list[str] = []
    candidate = "bas" + "vuru"

    verify_no_turkish.check_line(
        candidate,
        Path("fixture.md"),
        1,
        findings,
        verify_no_turkish.ALLOWED,
    )

    assert findings
