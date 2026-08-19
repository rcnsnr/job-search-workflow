#!/usr/bin/env python3
"""Local-first dashboard server for Job Search Workflow.

FastAPI app that renders job pipeline, profile, postings, scoring, and quality
audit badges from markdown source-of-truth files. No data leaves localhost.

Usage:
    python3 -m jsw dashboard
    uvicorn dashboard.server:app --port 3000
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import bleach
import markdown
import yaml
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PACKAGE_ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = PACKAGE_ROOT.parent
ROOT = Path(os.environ.get("JSW_WORKSPACE", Path.cwd())).expanduser().resolve()
if not any((ROOT / marker).exists() for marker in ("config", "fixtures", "inbox", "user_data")):
    if (SOURCE_ROOT / "fixtures").exists():
        ROOT = SOURCE_ROOT
JOBS_DIR = ROOT / "inbox" / "jobs"
RUNS_DIR = ROOT / "runs"
USER_DATA_DIR = ROOT / "user_data"
CONFIG_DIR = ROOT / "config"
FIXTURES_DIR = ROOT / "fixtures"
PRODUCT_NAME = "Job Search Workflow Community Edition"
MARKDOWN_CLEANER = bleach.Cleaner(
    tags={
        "a",
        "blockquote",
        "code",
        "em",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "li",
        "ol",
        "p",
        "pre",
        "strong",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "ul",
    },
    attributes={"a": ["href", "title"], "code": ["class"], "th": ["align"], "td": ["align"]},
    protocols={"http", "https", "mailto"},
    strip=True,
    strip_comments=True,
)

SCORING_CONFIG = CONFIG_DIR / "scoring.yaml" if CONFIG_DIR.exists() else ROOT / "config" / "scoring.yaml"

# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

PIPELINE_STAGES = [
    "new",
    "triage",
    "shortlist",
    "applied",
    "interview",
    "offer",
    "reject",
]


@dataclass
class JobCard:
    """A job posting rendered as a Kanban card."""

    filename: str
    title: str
    company: str
    location: str
    work_model: str
    source_url: str
    stage: str
    fit_score: Optional[float]
    decision: str
    quality_badge: str
    quality_recommendation: str
    compensation_signal: str
    captured_at: str
    raw_content: str


@dataclass
class DashboardData:
    """Aggregated dashboard state."""

    cards: list[JobCard] = field(default_factory=list)
    profile_html: str = ""
    scoring_config: dict = field(default_factory=dict)
    stage_counts: dict[str, int] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Markdown Parsing
# ---------------------------------------------------------------------------

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Split YAML frontmatter from markdown body."""
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    try:
        fm = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        fm = {}
    return fm, text[match.end():]


def render_safe_markdown(text: str) -> str:
    """Render Markdown and remove executable or untrusted HTML content."""
    rendered = markdown.markdown(text, extensions=["tables", "fenced_code"])
    return MARKDOWN_CLEANER.clean(rendered)


def format_compact_date(value: object) -> str:
    """Render date-like values consistently without exposing raw timestamps."""
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    text = str(value or "").strip()
    if not text:
        return "Not provided"
    iso_match = re.match(r"^(\d{4}-\d{2}-\d{2})", text)
    return iso_match.group(1) if iso_match else text


def infer_stage(fm: dict, body: str) -> str:
    """Infer pipeline stage from frontmatter and body content."""
    triage_state = str(fm.get("triage_state", "")).lower()
    status = str(fm.get("application_status", "")).lower()
    decision = str(fm.get("initial_decision", "")).lower()

    triage_stage_map = {
        "captured": "new",
        "triaged_reject": "reject",
        "triaged_conditional": "shortlist",
        "triaged_apply": "shortlist",
        "applied": "applied",
        "interview": "interview",
        "offer": "offer",
        "closed": "reject",
    }
    if triage_state in triage_stage_map:
        return triage_stage_map[triage_state]
    if "reject" in status or "reject" in decision:
        return "reject"
    if "offer" in status:
        return "offer"
    if "interview" in status:
        return "interview"
    if "applied" in status or "applied_at" in fm:
        return "applied"
    if "shortlist" in decision or "conditional" in decision:
        return "shortlist"
    if "triage" in decision or "fit_score" in fm:
        return "triage"
    return "new"


def parse_fit_score(fm: dict, body: str) -> Optional[float]:
    """Extract numeric fit score from frontmatter or body."""
    val = fm.get("initial_fit_score_value") or fm.get("fit_score")
    if val is not None:
        try:
            return float(val)
        except (TypeError, ValueError):
            pass
    match = re.search(r"Weighted Total.*?(\d+\.?\d*)\s*/\s*5", body)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


def parse_quality_signals(body: str) -> tuple[str, str]:
    """Extract quality badge and recommendation from triage/audit body."""
    badge = "skipped"
    recommendation = "skipped"

    badge_match = re.search(r"quality_badge.*?`(quality_\w+)`", body, re.IGNORECASE)
    if badge_match:
        badge = badge_match.group(1)

    rec_match = re.search(r"quality_audit_recommendation.*?`(\w+)`", body, re.IGNORECASE)
    if rec_match:
        recommendation = rec_match.group(1)

    return badge, recommendation


def parse_compensation_signal(body: str) -> str:
    """Extract compensation signal label from triage body."""
    match = re.search(r"compensation_signal.*?`(\w+)`", body, re.IGNORECASE)
    if match:
        return match.group(1)
    return "unknown"


def load_job_cards_from(directory: Path) -> list[JobCard]:
    """Load recognized job postings from one directory."""
    cards: list[JobCard] = []
    if not directory.exists():
        return cards

    for path in sorted(directory.glob("*.md")):
        if path.name in {"README.md", "source_consistency_report.md"}:
            continue
        text = path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        if not fm or not (fm.get("role_title") and fm.get("company")):
            continue

        title = str(fm.get("role_title", path.stem.replace("-", " ").title()))
        company = str(fm.get("company", "Unknown"))
        location = str(fm.get("location", "Unknown"))
        work_model = str(fm.get("work_model", "Unknown"))
        source_url = str(fm.get("source_url", ""))

        stage = infer_stage(fm, body)
        fit_score = parse_fit_score(fm, body)
        decision = str(fm.get("initial_decision", ""))
        quality_badge, quality_rec = parse_quality_signals(body)
        comp_signal = parse_compensation_signal(body)
        captured_at = format_compact_date(fm.get("captured_at"))

        cards.append(
            JobCard(
                filename=path.name,
                title=title,
                company=company,
                location=location,
                work_model=work_model,
                source_url=source_url,
                stage=stage,
                fit_score=fit_score,
                decision=decision,
                quality_badge=quality_badge,
                quality_recommendation=quality_rec,
                compensation_signal=comp_signal,
                captured_at=captured_at,
                raw_content=text,
            )
        )

    return cards


def load_job_cards() -> list[JobCard]:
    """Prefer real local records and fall back to public demo fixtures."""
    local_cards = load_job_cards_from(JOBS_DIR)
    return local_cards if local_cards else load_job_cards_from(FIXTURES_DIR)


def load_profile_html() -> str:
    """Render career profile markdown to HTML."""
    local_profile = USER_DATA_DIR / "career_profile.md"
    path = local_profile if local_profile.is_file() else FIXTURES_DIR / "sample-profile.md"
    if not path.exists():
        return "<p>Profile not found.</p>"
    text = path.read_text(encoding="utf-8")
    return render_safe_markdown(text)


def load_scoring_config() -> dict:
    """Load scoring.yaml configuration."""
    path = SCORING_CONFIG
    if not path.exists():
        return {}
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError:
        return {}


def load_posting(filename: str) -> str:
    """Load a single job posting as rendered HTML."""
    if Path(filename).name != filename or not filename.endswith(".md"):
        return "<p>Posting not found.</p>"
    candidates = (JOBS_DIR / filename, FIXTURES_DIR / filename)
    path = next((candidate for candidate in candidates if candidate.is_file()), None)
    if path is None:
        return "<p>Posting not found.</p>"
    text = path.read_text(encoding="utf-8")
    return render_safe_markdown(text)


def compute_stage_counts(cards: list[JobCard]) -> dict[str, int]:
    """Count cards per pipeline stage."""
    counts = {stage: 0 for stage in PIPELINE_STAGES}
    for card in cards:
        if card.stage in counts:
            counts[card.stage] += 1
    return counts


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title=PRODUCT_NAME,
    description="Local-first dashboard for job search pipeline tracking.",
    version="0.1.0",
)

templates = Jinja2Templates(directory=str(PACKAGE_ROOT / "templates"))
templates.env.globals["product_name"] = PRODUCT_NAME
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")


@app.get("/", response_class=HTMLResponse)
async def overview(request: Request):
    """Local workspace overview."""
    cards = load_job_cards()
    stage_counts = compute_stage_counts(cards)
    attention_cards = [card for card in cards if card.stage in {"new", "triage", "shortlist"}][:5]
    return templates.TemplateResponse(
        request=request,
        name="overview.html",
        context={
            "request": request,
            "cards": cards,
            "attention_cards": attention_cards,
            "stage_counts": stage_counts,
            "total_cards": len(cards),
        },
    )


@app.get("/pipeline", response_class=HTMLResponse)
async def pipeline_view(request: Request):
    """Adaptive pipeline board."""
    cards = load_job_cards()
    stage_counts = compute_stage_counts(cards)
    cards_by_stage = {stage: [] for stage in PIPELINE_STAGES}
    for card in cards:
        if card.stage in cards_by_stage:
            cards_by_stage[card.stage].append(card)

    return templates.TemplateResponse(
        request=request,
        name="kanban.html",
        context={
            "request": request,
            "stages": PIPELINE_STAGES,
            "cards_by_stage": cards_by_stage,
            "stage_counts": stage_counts,
            "total_cards": len(cards),
        },
    )


@app.get("/jobs", response_class=HTMLResponse)
async def jobs_view(request: Request):
    """Searchable local job inventory."""
    cards = load_job_cards()
    return templates.TemplateResponse(
        request=request,
        name="jobs.html",
        context={
            "request": request,
            "cards": cards,
            "stages": PIPELINE_STAGES,
        },
    )


@app.get("/profile", response_class=HTMLResponse)
async def profile_view(request: Request):
    """Profile summary view."""
    profile_html = load_profile_html()
    return templates.TemplateResponse(
        request=request,
        name="profile.html",
        context={
            "request": request,
            "profile_html": profile_html,
        },
    )


@app.get("/posting/{filename}", response_class=HTMLResponse)
async def posting_view(request: Request, filename: str):
    """Single job posting viewer."""
    posting_html = load_posting(filename)
    return templates.TemplateResponse(
        request=request,
        name="posting.html",
        context={
            "request": request,
            "filename": filename,
            "posting_html": posting_html,
        },
    )


@app.get("/scoring", response_class=HTMLResponse)
async def scoring_view(request: Request):
    """Scoring dashboard with quality audit badges."""
    cards = load_job_cards()
    scoring_config = load_scoring_config()
    return templates.TemplateResponse(
        request=request,
        name="scoring.html",
        context={
            "request": request,
            "cards": cards,
            "scoring_config": scoring_config,
            "quality_audit": scoring_config.get("quality_audit", {}),
        },
    )


@app.get("/api/cards", response_class=JSONResponse)
async def api_cards():
    """JSON API for all job cards."""
    cards = load_job_cards()
    return [
        {
            "filename": c.filename,
            "title": c.title,
            "company": c.company,
            "location": c.location,
            "work_model": c.work_model,
            "stage": c.stage,
            "fit_score": c.fit_score,
            "decision": c.decision,
            "quality_badge": c.quality_badge,
            "quality_recommendation": c.quality_recommendation,
            "compensation_signal": c.compensation_signal,
            "captured_at": c.captured_at,
        }
        for c in cards
    ]


@app.get("/api/stages", response_class=JSONResponse)
async def api_stages():
    """JSON API for pipeline stage summary."""
    cards = load_job_cards()
    return compute_stage_counts(cards)


# ---------------------------------------------------------------------------
# Smoke Test
# ---------------------------------------------------------------------------

def smoke_test() -> bool:
    """Verify server can load data without errors."""
    try:
        cards = load_job_cards()
        profile = load_profile_html()
        config = load_scoring_config()
        print(f"  cards loaded: {len(cards)}")
        print(f"  profile length: {len(profile)} chars")
        print(f"  scoring config keys: {list(config.keys())}")
        return True
    except Exception as e:
        print(f"  SMOKE TEST FAILED: {e}")
        return False


if __name__ == "__main__":
    smoke_test()
