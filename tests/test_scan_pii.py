from __future__ import annotations

import subprocess
import sys
from importlib import util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "scripts" / "scan_pii.py"
SPEC = util.spec_from_file_location("scan_pii", SCANNER)
assert SPEC and SPEC.loader
scan_pii = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = scan_pii
SPEC.loader.exec_module(scan_pii)


def test_scan_path_finds_denied_content_outside_legacy_directories(tmp_path: Path) -> None:
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    denied_name = "career" + "ops"
    (docs_dir / "note.md").write_text(f"Retired name: {denied_name}\n", encoding="utf-8")

    findings = scan_pii.scan_path(tmp_path)

    assert [(finding.path, finding.description) for finding in findings] == [
        ("docs/note.md", "retired private product name"),
    ]


def test_allowed_email_does_not_hide_denied_content_on_same_line(tmp_path: Path) -> None:
    owner_path = "/home/" + "orcun/private"
    (tmp_path / "README.md").write_text(
        f"Contact demo@example.com; never publish {owner_path}\n",
        encoding="utf-8",
    )

    findings = scan_pii.scan_path(tmp_path)

    assert len(findings) == 1
    assert findings[0].description == "owner home directory path"


def test_noreply_and_example_addresses_are_allowed(tmp_path: Path) -> None:
    (tmp_path / "metadata.toml").write_text(
        "maintainer = 'rcnsnr@users.noreply.github.com'\n"
        "sample = 'person@example.com'\n",
        encoding="utf-8",
    )

    assert scan_pii.scan_path(tmp_path) == []


def test_real_email_address_is_denied(tmp_path: Path) -> None:
    private_address = "person@" + "gmail.com"
    (tmp_path / "metadata.yaml").write_text(f"email: {private_address}\n", encoding="utf-8")

    findings = scan_pii.scan_path(tmp_path)

    assert len(findings) == 1
    assert findings[0].description == "email address"


def test_generated_and_dependency_directories_are_skipped(tmp_path: Path) -> None:
    denied_name = "career" + "ops"
    dependency_dir = tmp_path / "node_modules" / "package"
    dependency_dir.mkdir(parents=True)
    (dependency_dir / "README.md").write_text(denied_name, encoding="utf-8")

    assert scan_pii.scan_path(tmp_path) == []


def test_cli_respects_explicit_path(tmp_path: Path) -> None:
    clean_dir = tmp_path / "clean"
    dirty_dir = tmp_path / "dirty"
    clean_dir.mkdir()
    dirty_dir.mkdir()
    (clean_dir / "README.md").write_text("Generic public content\n", encoding="utf-8")
    private_address = "person@" + "gmail.com"
    (dirty_dir / "README.md").write_text(private_address, encoding="utf-8")

    clean = subprocess.run(
        [sys.executable, str(SCANNER), "--path", str(clean_dir)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    dirty = subprocess.run(
        [sys.executable, str(SCANNER), "--path", str(dirty_dir)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert clean.returncode == 0
    assert dirty.returncode == 1
    assert "README.md:1: email address" in dirty.stderr
