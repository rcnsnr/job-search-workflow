from __future__ import annotations

import json
from importlib import util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "check_license_policy.py"
SPEC = util.spec_from_file_location("check_license_policy", SCRIPT_PATH)
assert SPEC and SPEC.loader
license_policy = util.module_from_spec(SPEC)
SPEC.loader.exec_module(license_policy)


def test_current_repository_license_policy_passes() -> None:
    assert license_policy.check_license_policy(ROOT) == []


def test_extension_mit_metadata_is_rejected(tmp_path: Path) -> None:
    extension_dir = tmp_path / "tools" / "browser-extension"
    extension_dir.mkdir(parents=True)
    package = {"license": "MIT"}
    (extension_dir / "package.json").write_text(json.dumps(package), encoding="utf-8")

    errors = license_policy.check_extension_metadata(tmp_path)

    assert any("package.json" in error and "MIT" in error for error in errors)


def test_modified_canonical_license_is_rejected(tmp_path: Path) -> None:
    (tmp_path / "LICENSE").write_text("modified license\n", encoding="utf-8")

    errors = license_policy.check_canonical_license(tmp_path)

    assert any("official PolyForm" in error for error in errors)


def test_missing_pull_request_license_confirmation_is_rejected(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    template = repository / ".github" / "pull_request_template.md"
    template.parent.mkdir(parents=True)

    errors = license_policy.check_policy_documents(repository)

    assert ".github/pull_request_template.md is missing" in errors
