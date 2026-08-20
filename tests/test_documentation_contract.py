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


def test_release_notes_always_link_to_the_current_upgrade_guide() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    checklist = (ROOT / "PUBLISH_CHECKLIST.md").read_text(encoding="utf-8")
    template = (ROOT / "docs" / "release-notes-template.md").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "release-policy.yml").read_text(
        encoding="utf-8"
    )

    guide_url = "https://github.com/rcnsnr/job-search-workflow/blob/main/docs/UPGRADING.md"
    assert (ROOT / "docs" / "UPGRADING.md").is_file()
    assert "docs/UPGRADING.md" in readme
    assert "docs/UPGRADING.md" in changelog
    assert "upgrade.sh" in checklist
    assert "upgrade.bat" in checklist
    assert guide_url in checklist
    assert guide_url in template
    assert "types: [published, edited]" in workflow
    assert "ref: main" in workflow
    assert "scripts/check_release_notes_upgrade_link.py" in workflow


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


def test_onboarding_paths_make_ai_data_boundary_explicit() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    getting_started = (ROOT / "docs" / "getting-started" / "GETTING_STARTED.md").read_text(
        encoding="utf-8"
    )
    template_readme = (ROOT / "templates" / "user-data-skeleton" / "README.md").read_text(
        encoding="utf-8"
    )
    assistant_guide = (
        ROOT / "docs" / "getting-started" / "AI-ASSISTANT-INTEGRATION.md"
    ).read_text(encoding="utf-8")
    quickstart = (ROOT / "docs" / "getting-started" / "QUICKSTART-30MIN.md").read_text(
        encoding="utf-8"
    )

    assert "docs/getting-started/QUICKSTART-30MIN.md" in readme
    assert "docs/getting-started/AI-ASSISTANT-INTEGRATION.md" in readme
    assert "- `templates/`" in readme
    assert "## Advanced: Browser Extension" in readme
    assert "[AI Assistant Integration Guide](AI-ASSISTANT-INTEGRATION.md)" in getting_started
    assert "[30-Minute Quickstart](QUICKSTART-30MIN.md)" in getting_started
    assert "The framework does not send your files to an AI provider." in assistant_guide
    assert "Do not assume that a browser-based AI chat can read a local file path." in assistant_guide
    assert "The 30-minute path starts after base setup is complete." in quickstart
    assert "## Starter Files" in template_readme
    assert "## Optional Working Files" in template_readme
