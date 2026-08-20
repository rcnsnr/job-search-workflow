from __future__ import annotations

import sys
from importlib import util
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT / "dashboard" / "server.py"
SPEC = util.spec_from_file_location("dashboard_server", SERVER_PATH)
assert SPEC and SPEC.loader
server = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = server
SPEC.loader.exec_module(server)
client = TestClient(server.app)


def test_primary_pages_use_community_edition_shell() -> None:
    for path in ("/", "/pipeline", "/jobs", "/profile", "/scoring"):
        response = client.get(path)

        assert response.status_code == 200
        assert "Job Search Workflow Community Edition" in response.text
        assert 'id="main-content"' in response.text
        assert 'aria-label="Primary navigation"' in response.text
        assert "Theme" in response.text
        assert "Copyright &copy; 2026" in response.text
        assert "Orcun Sener" in response.text
        assert 'href="https://github.com/rcnsnr/job-search-workflow"' in response.text
        assert 'target="_blank" rel="noopener noreferrer"' in response.text
        assert "Noncommercial use only" in response.text


def test_public_dashboard_has_no_retired_private_product_name() -> None:
    retired_name = "career" + "ops"

    for path in ("/", "/pipeline", "/jobs", "/profile", "/scoring"):
        response = client.get(path)

        assert retired_name not in response.text.lower()


def test_overview_summarizes_local_pipeline() -> None:
    response = client.get("/")

    assert "Workspace overview" in response.text
    assert "Pipeline snapshot" in response.text
    assert "Needs attention" in response.text
    assert "Local files" in response.text
    assert "Your support helps keep the Community Edition improving" in response.text
    assert 'href="https://github.com/sponsors/rcnsnr"' in response.text


def test_demo_workspace_covers_the_complete_pipeline() -> None:
    cards = server.load_job_cards_from(server.FIXTURES_DIR)

    assert len(cards) >= 10
    assert set(server.PIPELINE_STAGES) <= {card.stage for card in cards}


def test_pipeline_renders_every_stage_without_horizontal_board_contract() -> None:
    response = client.get("/pipeline")

    assert response.status_code == 200
    assert 'class="pipeline-grid"' in response.text
    for stage in server.PIPELINE_STAGES:
        assert f'data-stage="{stage}"' in response.text


def test_jobs_page_has_local_filters_and_compact_dates() -> None:
    response = client.get("/jobs")

    assert response.status_code == 200
    assert 'id="job-search"' in response.text
    assert 'id="job-stage"' in response.text
    assert "2026-07-01" in response.text
    assert "2026-07-01T00:00:00" not in response.text


def test_job_detail_lists_only_application_documents() -> None:
    response = client.get("/posting/sample-job-posting.md")

    assert response.status_code == 200
    assert 'class="posting-layout"' in response.text
    assert "Application files" in response.text
    assert "sample-cv.pdf" in response.text
    assert "sample-cv.tex" not in response.text
    assert "sample-cover-letter.md" in response.text
    assert "sample-application-answers.md" in response.text
    assert "sample-triage-run.md" not in response.text
    assert "sample-quality-audit.md" not in response.text
    assert "source_id:" not in response.text
    assert "Extracted Facts" in response.text


def test_demo_pdf_is_an_available_application_document() -> None:
    response = client.get(
        "/application-file/sample-job-posting.md/sample-cv.pdf"
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")


def test_application_document_route_rejects_non_application_fixture() -> None:
    response = client.get(
        "/application-file/sample-job-posting.md/sample-triage-run.md"
    )

    assert response.status_code == 404


def test_application_document_route_renders_markdown() -> None:
    response = client.get(
        "/application-file/sample-job-posting.md/sample-cover-letter.md"
    )

    assert response.status_code == 200
    assert "Cover letter" in response.text
    assert "Dear Hiring Team" in response.text


def test_application_documents_use_posting_specific_package(
    tmp_path: Path, monkeypatch,
) -> None:
    packages = tmp_path / "applications"
    package = packages / "orion-role"
    package.mkdir(parents=True)
    (package / "orion-cv.pdf").write_bytes(b"%PDF-1.4")
    (package / "orion-cv.tex").write_text("Source only", encoding="utf-8")
    (package / "cover-letter.md").write_text("Dear team", encoding="utf-8")
    (package / "application-answers.md").write_text("Answer", encoding="utf-8")
    (package / "triage-notes.md").write_text("Internal", encoding="utf-8")
    (package / "nested").mkdir()
    (package / "nested" / "resume.pdf").write_bytes(b"%PDF-1.4")
    monkeypatch.setattr(server, "APPLICATIONS_DIR", packages)

    documents = server.load_application_documents("orion-role.md")

    assert [document.label for document in documents] == [
        "CV",
        "Cover letter",
        "Application answers",
    ]
    assert {document.filename for document in documents} == {
        "orion-cv.pdf",
        "cover-letter.md",
        "application-answers.md",
    }


def test_profile_surfaces_career_direction_and_decision_criteria() -> None:
    response = client.get("/profile")

    assert response.status_code == 200
    assert "Career Direction" in response.text
    assert "Decision criteria" in response.text
    assert "AI-enabled platform engineering" in response.text
    assert "No recurring overnight on-call" in response.text


def test_scoring_explains_quality_penalties_in_plain_language() -> None:
    response = client.get("/scoring")

    assert response.status_code == 200
    assert "How quality risks change a score" in response.text
    assert "Inactive posting risk" in response.text
    assert "Unfair process risk" in response.text
    assert "Delivery chaos risk" in response.text
    assert "No score change" in response.text
    assert "Subtract 1.5 points" in response.text
    assert "Two or more high risks" in response.text
    assert "4.2 fit score" in response.text


def test_format_score_adjustment_uses_plain_language() -> None:
    assert server.format_score_adjustment(0.0) == "No score change"
    assert server.format_score_adjustment(-0.5) == "Subtract 0.5 points"
    assert server.format_score_adjustment(-1.0) == "Subtract 1.0 point"
    assert server.format_score_adjustment("unknown") == "Not configured"


def test_format_date_normalizes_iso_timestamp() -> None:
    assert server.format_compact_date("2026-07-21T00:00:00+03:00") == "2026-07-21"
    assert server.format_compact_date("2026-07-21") == "2026-07-21"
    assert server.format_compact_date("") == "Not provided"


def test_pipeline_stage_prefers_generic_triage_state() -> None:
    assert server.infer_stage({"triage_state": "captured"}, "") == "new"
    assert server.infer_stage({"triage_state": "triaged_apply"}, "") == "shortlist"
    assert server.infer_stage({"triage_state": "triaged_reject"}, "") == "reject"


def test_markdown_rendering_removes_executable_content() -> None:
    rendered = server.render_safe_markdown(
        "# Safe heading\n\n<script>alert('unsafe')</script>\n\n"
        "[unsafe link](javascript:alert('unsafe'))\n\n| A | B |\n| - | - |\n| 1 | 2 |"
    )

    assert "<h1>Safe heading</h1>" in rendered
    assert "<table>" in rendered
    assert "<script" not in rendered
    assert "javascript:" not in rendered


def test_cards_api_remains_available() -> None:
    response = client.get("/api/cards")

    assert response.status_code == 200
    payload = response.json()
    assert payload
    assert {"filename", "title", "company", "stage"} <= payload[0].keys()
