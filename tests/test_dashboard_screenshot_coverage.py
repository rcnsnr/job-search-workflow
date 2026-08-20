from __future__ import annotations

import sys
from importlib import util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "check_dashboard_screenshot_coverage.py"
SPEC = util.spec_from_file_location("dashboard_screenshot_coverage", SCRIPT_PATH)
assert SPEC and SPEC.loader
coverage = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = coverage
SPEC.loader.exec_module(coverage)


def test_visual_dashboard_source_requires_every_stable_screenshot() -> None:
    changed_paths = {
        "dashboard/static/style.css",
        "assets/screenshots/dashboard-overview.png",
    }

    assert coverage.missing_screenshot_updates(changed_paths) == set(
        coverage.STABLE_SCREENSHOTS[1:]
    )


def test_nonvisual_change_does_not_require_screenshot_refresh() -> None:
    assert coverage.missing_screenshot_updates({"README.md"}) == set()


def test_capture_receipt_covers_a_recheck_with_identical_pixels() -> None:
    changed_paths = {
        "dashboard/server.py",
        coverage.CAPTURE_RECEIPT,
    }

    assert coverage.missing_screenshot_updates(changed_paths) == set()


def test_public_screenshot_assets_and_readme_preview_are_present() -> None:
    for screenshot in coverage.STABLE_SCREENSHOTS:
        path = ROOT / screenshot
        assert path.exists()
        assert path.stat().st_size > 0

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert coverage.STABLE_SCREENSHOTS[0] in readme
    assert (ROOT / coverage.CAPTURE_RECEIPT).is_file()
