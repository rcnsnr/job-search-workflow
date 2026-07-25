import os
import sys
import tempfile
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

# Make public/scripts/ importable during tests
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from linkedin_capture_server import create_app


@pytest.fixture
def client():
    with tempfile.TemporaryDirectory() as tmp_dir:
        app = create_app(inbox_dir=tmp_dir)
        with TestClient(app) as test_client:
            yield test_client, tmp_dir


def test_health(client):
    test_client, _ = client
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_capture_creates_markdown_file(client):
    test_client, tmp_dir = client
    payload = {
        "source_id": "test-123",
        "source_url": "https://www.linkedin.com/jobs/view/123/",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "company": "Acme",
        "role_title": "Senior Platform Engineer",
        "location": "Remote - Europe",
        "work_model": "Remote",
        "source_class": "linkedin_job",
        "capture_method": "unattended_scan",
        "why_captured": "SRE/Platform fit, AI-assisted engineering signals",
        "extracted_facts": {"team_size": "10-15", "tech_stack": "Python, Kubernetes"},
        "fit_hypothesis": "Strong SRE background alignment",
    }

    response = test_client.post("/capture", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["saved"]
    assert data["source_id"] == "test-123"
    assert data["path"].startswith(tmp_dir)

    files = os.listdir(tmp_dir)
    assert len(files) == 1

    content = open(os.path.join(tmp_dir, files[0]), encoding="utf-8").read()
    assert "source_id: test-123" in content
    assert "source_url: https://www.linkedin.com/jobs/view/123/" in content
    assert "## Why Captured" in content
    assert payload["why_captured"] in content
    assert "## Extracted Facts" in content
    assert "## Fit Hypothesis" in content


def test_capture_dedup_same_source_url(client):
    test_client, _ = client
    payload = {
        "source_id": "test-123",
        "source_url": "https://www.linkedin.com/jobs/view/123/",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "company": "Acme",
        "role_title": "Senior Platform Engineer",
        "location": "Remote",
        "work_model": "Remote",
        "source_class": "linkedin_job",
        "capture_method": "unattended_scan",
        "why_captured": "first",
        "extracted_facts": {},
        "fit_hypothesis": "first",
    }

    response1 = test_client.post("/capture", json=payload)
    assert response1.status_code == 201

    payload["why_captured"] = "second"
    response2 = test_client.post("/capture", json=payload)
    assert response2.status_code == 200
    assert response2.json()["saved"] is False
    assert response2.json()["reason"] == "duplicate"


def test_capture_missing_required_field(client):
    test_client, _ = client
    payload = {
        "source_id": "test-123",
        "source_url": "https://www.linkedin.com/jobs/view/123/",
    }
    response = test_client.post("/capture", json=payload)
    assert response.status_code == 422


def test_captures_list_since(client):
    test_client, _ = client
    payload = {
        "source_id": "test-456",
        "source_url": "https://www.linkedin.com/jobs/view/456/",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "company": "Beta",
        "role_title": "SRE",
        "location": "Remote",
        "work_model": "Remote",
        "source_class": "linkedin_job",
        "capture_method": "unattended_scan",
        "why_captured": "SRE match",
        "extracted_facts": {},
        "fit_hypothesis": "good",
    }

    test_client.post("/capture", json=payload)

    response = test_client.get("/captures?since=2000-01-01T00:00:00+00:00")
    assert response.status_code == 200
    data = response.json()
    assert len(data["captures"]) == 1
    assert data["captures"][0]["source_id"] == "test-456"


def test_batch_capture_creates_multiple_files(client):
    test_client, tmp_dir = client
    base_payload = {
        "source_url": "https://www.linkedin.com/jobs/view/{}/",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "company": "Acme",
        "role_title": "Senior Platform Engineer",
        "location": "Remote",
        "work_model": "Remote",
        "source_class": "linkedin_job",
        "capture_method": "unattended_scan",
        "why_captured": "SRE/Platform fit",
        "extracted_facts": {},
        "fit_hypothesis": "Strong alignment",
    }
    jobs = [
        {**base_payload, "source_id": f"batch-{i}", "source_url": base_payload["source_url"].format(i)}
        for i in range(3)
    ]

    response = test_client.post("/batch", json={"jobs": jobs})
    assert response.status_code == 201
    data = response.json()
    assert len(data["results"]) == 3
    assert all(r["saved"] for r in data["results"])

    files = os.listdir(tmp_dir)
    assert len(files) == 3


def test_batch_empty_jobs_returns_200(client):
    test_client, _ = client
    response = test_client.post("/batch", json={"jobs": []})
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []


def test_batch_capture_dedups_against_existing_captures(client):
    test_client, _ = client
    base_payload = {
        "source_id": "dup-1",
        "source_url": "https://www.linkedin.com/jobs/view/111/",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "company": "Acme",
        "role_title": "Engineer",
        "location": "Remote",
        "work_model": "Remote",
        "source_class": "linkedin_job",
        "capture_method": "unattended_scan",
        "why_captured": "first",
        "extracted_facts": {},
        "fit_hypothesis": "first",
    }
    test_client.post("/capture", json=base_payload)

    response = test_client.post("/batch", json={"jobs": [base_payload]})
    assert response.status_code == 201
    data = response.json()
    assert data["results"][0]["saved"] is False
    assert data["results"][0]["reason"] == "duplicate"


def test_capture_non_ascii_body_is_written(client):
    test_client, tmp_dir = client
    payload = {
        "source_id": "test-tr",
        "source_url": "https://www.linkedin.com/jobs/view/999/",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "company": "Example Corp",
        "role_title": "Platform Engineer",
        "location": "Remote",
        "work_model": "Remote",
        "source_class": "generic_job_board",
        "capture_method": "unattended_scan",
        "why_captured": "SRE geçmişi ile uyumlu.",
        "extracted_facts": {"team": "small", "tech": "Python"},
        "fit_hypothesis": "İyi bir uyum.",
    }

    response = test_client.post("/capture", json=payload)
    assert response.status_code == 201

    files = os.listdir(tmp_dir)
    content = open(os.path.join(tmp_dir, files[0]), encoding="utf-8").read()
    assert "SRE geçmişi ile uyumlu." in content
    assert "İyi bir uyum." in content
