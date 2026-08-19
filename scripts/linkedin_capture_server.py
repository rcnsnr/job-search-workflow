#!/usr/bin/env python3
"""Job Search Workflow Capture Server.

Receives job records from the Job Search Workflow Capture browser extension and
writes them as Markdown files under inbox/jobs/. Front-matter is in English;
free-form sections are in Turkish to match Job Search Workflow capture conventions
(GAP-20260622-02).
"""

import os
import re
from datetime import datetime, timezone
from typing import Any

import yaml
from fastapi import FastAPI
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

DEFAULT_INBOX_DIR = "inbox/jobs"


class CapturePayload(BaseModel):
    source_id: str = Field(..., description="Unique source identifier")
    source_url: str = Field(..., description="Canonical URL of the posting")
    captured_at: str = Field(..., description="ISO 8601 capture timestamp")
    company: str = Field(..., description="Company name")
    role_title: str = Field(..., description="Role title")
    location: str = Field(default="", description="Location text")
    work_model: str = Field(default="", description="Work model")
    source_class: str = Field(default="linkedin_job", description="Source taxonomy class")
    capture_method: str = Field(default="unattended_scan", description="How the record was captured")
    why_captured: str = Field(default="", description="Reason for capturing")
    extracted_facts: dict[str, Any] = Field(default_factory=dict, description="Structured extracted facts")
    fit_hypothesis: str = Field(default="", description="Fit hypothesis in Turkish prose")


class CaptureResponse(BaseModel):
    saved: bool
    source_id: str
    path: str
    reason: str | None = None


class CaptureBatchPayload(BaseModel):
    jobs: list[CapturePayload] = Field(..., description="Batch of job records")


class CaptureBatchResponse(BaseModel):
    results: list[CaptureResponse]


def slugify(value: str) -> str:
    """Create a filesystem-safe slug from arbitrary text."""
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "unknown"


def build_filename(payload: CapturePayload) -> str:
    """Build a deterministic markdown filename."""
    date_prefix = payload.captured_at[:10] if len(payload.captured_at) >= 10 else "unknown"
    company_slug = slugify(payload.company)
    role_slug = slugify(payload.role_title)
    return f"{date_prefix}-{company_slug}-{role_slug}-{payload.source_id}.md"


def build_markdown(payload: CapturePayload) -> str:
    """Build Job Search Workflow-compatible markdown with English front-matter."""
    front_matter = {
        "source_id": payload.source_id,
        "source_url": payload.source_url,
        "captured_at": payload.captured_at,
        "company": payload.company,
        "role_title": payload.role_title,
        "location": payload.location,
        "work_model": payload.work_model,
        "source_class": payload.source_class,
        "capture_method": payload.capture_method,
    }

    yaml_header = yaml.safe_dump(
        front_matter,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
    )

    extracted_facts_lines = "\n".join(
        f"- {key}: {value}"
        for key, value in payload.extracted_facts.items()
    )

    return (
        f"---\n{yaml_header}---\n"
        "\n"
        "## Why Captured\n"
        "\n"
        f"{payload.why_captured}\n"
        "\n"
        "## Extracted Facts\n"
        "\n"
        f"{extracted_facts_lines}\n"
        "\n"
        "## Fit Hypothesis\n"
        "\n"
        f"{payload.fit_hypothesis}\n"
    )


def find_existing_capture(inbox_dir: str, source_url: str) -> str | None:
    """Return the path of an existing capture with the same source_url."""
    if not os.path.isdir(inbox_dir):
        return None
    for filename in os.listdir(inbox_dir):
        if not filename.endswith(".md"):
            continue
        filepath = os.path.join(inbox_dir, filename)
        try:
            with open(filepath, encoding="utf-8") as file:
                content = file.read()
        except OSError:
            continue
        if f"source_url: {source_url}" in content:
            return filepath
    return None


def create_app(inbox_dir: str | None = None) -> FastAPI:
    """Create the FastAPI app with an optional inbox directory override."""
    inbox_dir = inbox_dir or os.environ.get("JSW_INBOX_DIR") or DEFAULT_INBOX_DIR
    inbox_path = os.path.abspath(inbox_dir)
    os.makedirs(inbox_path, exist_ok=True)

    app = FastAPI(title="Job Search Workflow Capture Server", version="2.0.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "job-search-workflow-capture"}

    @app.get("/captures")
    def captures(since: str = "1970-01-01T00:00:00+00:00") -> dict[str, list[dict[str, Any]]]:
        """List captures since a given ISO timestamp."""
        result = []
        if os.path.isdir(inbox_path):
            for filename in sorted(os.listdir(inbox_path)):
                if not filename.endswith(".md"):
                    continue
                filepath = os.path.join(inbox_path, filename)
                try:
                    mtime = datetime.fromtimestamp(os.path.getmtime(filepath), tz=timezone.utc)
                    if mtime.isoformat() >= since:
                        with open(filepath, encoding="utf-8") as file:
                            content = file.read()
                        source_id = ""
                        source_url = ""
                        for line in content.splitlines():
                            if line.startswith("source_id:"):
                                source_id = line.split(":", 1)[1].strip()
                            elif line.startswith("source_url:"):
                                source_url = line.split(":", 1)[1].strip()
                        result.append({
                            "filename": filename,
                            "source_id": source_id,
                            "source_url": source_url,
                            "mtime": mtime.isoformat(),
                        })
                except OSError:
                    continue
        return {"captures": result}

    def save_payload(payload: CapturePayload) -> CaptureResponse:
        existing_path = find_existing_capture(inbox_path, payload.source_url)
        if existing_path:
            return CaptureResponse(
                saved=False,
                source_id=payload.source_id,
                path=existing_path,
                reason="duplicate",
            )

        filename = build_filename(payload)
        filepath = os.path.join(inbox_path, filename)
        markdown = build_markdown(payload)

        with open(filepath, "w", encoding="utf-8") as file:
            file.write(markdown)

        return CaptureResponse(
            saved=True,
            source_id=payload.source_id,
            path=filepath,
        )

    @app.post("/capture", status_code=201, response_model=CaptureResponse)
    def capture(payload: CapturePayload) -> JSONResponse:
        result = save_payload(payload)
        status = 200 if result.reason == "duplicate" else 201
        return JSONResponse(status_code=status, content=result.model_dump())

    @app.post("/batch", status_code=201, response_model=CaptureBatchResponse)
    def batch(payload: CaptureBatchPayload) -> JSONResponse:
        results = [save_payload(job) for job in payload.jobs]
        status = 200 if len(payload.jobs) == 0 else 201
        return JSONResponse(status_code=status, content={"results": [r.model_dump() for r in results]})

    return app


def main() -> None:
    import uvicorn

    port = int(os.environ.get("JSW_CAPTURE_PORT", "8766"))
    app = create_app()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
