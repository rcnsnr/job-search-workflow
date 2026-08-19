from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")


def test_local_markdown_links_resolve() -> None:
    missing: list[str] = []
    for path in sorted(ROOT.rglob("*.md")):
        if "node_modules" in path.parts:
            continue
        content = path.read_text(encoding="utf-8")
        for match in MARKDOWN_LINK.finditer(content):
            target = match.group(1).strip().split()[0].strip("<>")
            if target.startswith(("#", "http://", "https://", "mailto:")):
                continue
            relative = target.split("#", 1)[0]
            if relative and not (path.parent / relative).resolve().exists():
                line = content.count("\n", 0, match.start()) + 1
                missing.append(f"{path.relative_to(ROOT)}:{line}: {target}")

    assert missing == []


def test_setup_guide_matches_current_workflow_and_node_contract() -> None:
    guide = (ROOT / "docs" / "setup-and-verification.md").read_text(encoding="utf-8")

    assert ".github/workflows/setup-audit.yml" in guide
    assert "Node.js >= 22.12 is required" in guide
    assert "Node.js >= 18 is required" not in guide


def test_docx_reference_path_matches_validator_contract() -> None:
    getting_started = (ROOT / "docs" / "getting-started" / "GETTING_STARTED.md").read_text(
        encoding="utf-8"
    )
    document_mode = (ROOT / "modes" / "05_DOCUMENT_OUTPUT.md").read_text(encoding="utf-8")

    for content in (getting_started, document_mode):
        assert "exports/cv-reference.docx" in content
        assert "templates/cv-reference.docx" not in content
        assert "exports/cv-variants-2026-06-21" not in content
