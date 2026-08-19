#!/usr/bin/env python3
"""Fail closed when first-party license and commercial boundaries drift."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLYFORM_LICENSE_ID = "PolyForm-Noncommercial-1.0.0"
OFFICIAL_LICENSE_SHA256 = "ffcca38841adb694b6f380647e15f17c446a4d1656fed51a1e2041d064c94cc8"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_canonical_license(root: Path) -> list[str]:
    errors: list[str] = []
    license_path = root / "LICENSE"
    if not license_path.is_file():
        return ["LICENSE is missing; the official PolyForm text is required"]

    digest = hashlib.sha256(license_path.read_bytes()).hexdigest()
    if digest != OFFICIAL_LICENSE_SHA256:
        errors.append("LICENSE is not byte-identical to the official PolyForm Noncommercial 1.0.0 text")

    notice_path = root / "NOTICE"
    if not notice_path.is_file():
        errors.append("NOTICE is missing")
    else:
        notice = read_text(notice_path)
        if "Required Notice: Copyright 2026 Orcun Sener" not in notice:
            errors.append("NOTICE is missing the required copyright notice")
        if POLYFORM_LICENSE_ID not in notice:
            errors.append("NOTICE is missing the PolyForm SPDX identifier")
    return errors


def check_extension_metadata(root: Path) -> list[str]:
    errors: list[str] = []
    extension = root / "tools" / "browser-extension"
    package_path = extension / "package.json"
    if not package_path.is_file():
        errors.append("browser-extension package.json is missing")
    else:
        package = json.loads(read_text(package_path))
        actual = package.get("license")
        if actual != POLYFORM_LICENSE_ID:
            errors.append(f"browser-extension package.json license is {actual!r}, not {POLYFORM_LICENSE_ID}")

    lock_path = extension / "package-lock.json"
    if not lock_path.is_file():
        errors.append("browser-extension package-lock.json is missing")
    else:
        lock = json.loads(read_text(lock_path))
        actual = lock.get("packages", {}).get("", {}).get("license")
        if actual != POLYFORM_LICENSE_ID:
            errors.append(f"browser-extension package-lock root license is {actual!r}, not {POLYFORM_LICENSE_ID}")

    readme_path = extension / "readme.md"
    if not readme_path.is_file():
        errors.append("browser-extension readme.md is missing")
    else:
        readme = read_text(readme_path)
        if "MIT License" in readme:
            errors.append("browser-extension readme.md still claims the MIT License")
        if "../../LICENSE" not in readme or "../../COMMERCIAL_USE.md" not in readme:
            errors.append("browser-extension readme.md does not link the root license boundary")
    return errors


def check_policy_documents(root: Path) -> list[str]:
    errors: list[str] = []
    required_phrases = {
        "README.md": ("source-available", "Commercial use is not granted"),
        "COMMERCIAL_USE.md": ("Owner-Operated SaaS", "separate written agreement"),
        "CLA.md": ("source-available", "separate commercial license terms"),
        "CONTRIBUTING.md": ("Contributor License Agreement", "separate commercial licenses"),
        ".github/pull_request_template.md": (
            "Contributor and License Confirmation",
            "maintainer may offer separate commercial licenses",
        ),
        "PUBLISH_CHECKLIST_EXTENSION.md": ("LICENSE", "NOTICE", "COMMERCIAL_USE.md"),
        "pyproject.toml": (
            "PolyForm Noncommercial 1.0.0",
            'license-files = ["LICENSE", "NOTICE", "COMMERCIAL_USE.md"]',
        ),
    }
    for relative, phrases in required_phrases.items():
        path = root / relative
        if not path.is_file():
            errors.append(f"{relative} is missing")
            continue
        content = read_text(path)
        for phrase in phrases:
            if phrase not in content:
                errors.append(f"{relative} is missing required license phrase: {phrase}")

    cla_path = root / "CLA.md"
    if cla_path.is_file() and "open-source project" in read_text(cla_path).lower():
        errors.append("CLA.md incorrectly describes Community Edition as an open-source project")
    return errors


def check_license_policy(root: Path = ROOT) -> list[str]:
    return [
        *check_canonical_license(root),
        *check_extension_metadata(root),
        *check_policy_documents(root),
    ]


def main() -> int:
    errors = check_license_policy()
    if errors:
        for error in errors:
            print(f"FAIL license_policy: {error}")
        return 1
    print("PASS license_policy: PolyForm noncommercial and commercial SaaS boundaries are aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
