#!/usr/bin/env python3
"""Local read-only dashboard for Job Search Workflow job records."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from dataclasses import asdict, dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parents[1]
JOBS_DIR = ROOT / "inbox" / "jobs"
IGNORED_FILES = {"README.md"}


@dataclass(frozen=True)
class JobRecord:
    filename: str
    title: str
    source_id: str
    source_url: str
    catalog_root_url: str
    captured_at: str
    company: str
    role_title: str
    location: str
    work_model: str
    source_class: str
    capture_method: str
    why_captured: list[str]
    extracted_facts: list[str]
    primary_match: str
    track_family: str
    initial_fit_score: str
    initial_fit_score_value: float | None
    initial_decision: str
    main_risk: str
    application_status: str
    applied_at: str
    materials_used: str
    tracking_note: str
    is_applied: bool


def strip_wrapping(value: str) -> str:
    value = value.strip()
    if value.startswith("<") and value.endswith(">"):
        return value[1:-1]
    return value


def normalize_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", stripped).strip().casefold()


def parse_bullets(lines: Iterable[str]) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    for raw_line in lines:
        line = raw_line.rstrip()
        if not line.strip():
            continue
        if line.startswith("- "):
            if current:
                items.append(" ".join(current).strip())
            current = [line[2:].strip()]
            continue
        if current:
            current.append(line.strip())
    if current:
        items.append(" ".join(current).strip())
    return items


def parse_pairs(items: list[str]) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for item in items:
        if ":" not in item:
            continue
        key, value = item.split(":", 1)
        pairs[normalize_key(key)] = value.strip()
    return pairs


def first_present(pairs: dict[str, str], *keys: str, default: str = "Unknown") -> str:
    for key in keys:
        value = pairs.get(normalize_key(key))
        if value:
            return value
    return default


def infer_track_family(primary_match: str, title: str) -> str:
    text = f"{primary_match} {title}".lower()
    sre_keywords = {
        "sre",
        "reliability",
        "platform",
        "devops",
        "observability",
        "cloud",
        "infrastructure",
    }
    ai_keywords = {
        "ai",
        "agent",
        "codex",
        "workflow",
        "developer",
        "sdlc",
        "software engineer",
    }

    sre_hits = sum(1 for keyword in sre_keywords if keyword in text)
    ai_hits = sum(1 for keyword in ai_keywords if keyword in text)

    if sre_hits and ai_hits:
        return "Hybrid"
    if ai_hits:
        return "AI-native / AI-assisted Dev"
    return "SRE / Platform / DevOps"


def parse_fit_score(value: str) -> float | None:
    match = re.search(r"(\d+(?:\.\d+)?)\s*/\s*10", value)
    if not match:
        return None
    return float(match.group(1))


def infer_applied(status: str) -> bool:
    lowered = status.strip().lower()
    return lowered.startswith("applied") or lowered == "applied"


def parse_job_record(path: Path) -> JobRecord:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or not lines[0].startswith("# "):
        raise ValueError(f"invalid_title:{path.name}")

    title = lines[0][2:].strip()
    metadata: dict[str, str] = {}
    current_key: str | None = None
    idx = 1
    while idx < len(lines) and not lines[idx].startswith("## "):
        raw_line = lines[idx]
        idx += 1
        if not raw_line.strip():
            continue
        if raw_line[:1].isspace():
            if current_key is None:
                raise ValueError(
                    f"invalid_metadata_continuation:{path.name}:{raw_line.strip()}"
                )
            continuation = raw_line.strip()
            metadata[current_key] = f"{metadata[current_key]} {continuation}".strip()
            continue
        line = raw_line.strip()
        if ":" not in line:
            raise ValueError(f"invalid_metadata_line:{path.name}:{line}")
        key, value = line.split(":", 1)
        current_key = key.strip()
        metadata[current_key] = strip_wrapping(value.strip())

    sections: dict[str, list[str]] = {}
    current_heading: str | None = None
    buffer: list[str] = []
    while idx < len(lines):
        line = lines[idx]
        idx += 1
        if line.startswith("## "):
            if current_heading is not None:
                sections[current_heading] = parse_bullets(buffer)
            current_heading = line[3:].strip()
            buffer = []
            continue
        buffer.append(line)
    if current_heading is not None:
        sections[current_heading] = parse_bullets(buffer)

    if not metadata and "Capture Metadata" in sections:
        metadata = parse_pairs(sections["Capture Metadata"])

    fit_pairs = parse_pairs(sections.get("Fit Hypothesis", []))
    primary_match = first_present(fit_pairs, "primary match")
    initial_fit_score = first_present(
        fit_pairs,
        "initial fit score",
    )
    initial_decision = first_present(
        fit_pairs, "initial decision"
    )
    main_risk = first_present(fit_pairs, "main risk")

    application_pairs = parse_pairs(sections.get("Application Status", []))
    application_status = first_present(application_pairs, "status")
    applied_at = first_present(
        application_pairs, "applied at"
    )
    materials_used = first_present(
        application_pairs, "materials used"
    )
    tracking_note = first_present(
        application_pairs, "tracking note"
    )
    if initial_decision == "Unknown" and application_status != "Unknown":
        initial_decision = application_status

    return JobRecord(
        filename=path.name,
        title=title,
        source_id=metadata.get("source_id", "Unknown"),
        source_url=metadata.get("source_url", "Unknown"),
        catalog_root_url=metadata.get("catalog_root_url", "Unknown"),
        captured_at=metadata.get("captured_at", "Unknown"),
        company=metadata.get("company", "Unknown"),
        role_title=metadata.get("role_title", title),
        location=metadata.get("location", "Unknown"),
        work_model=metadata.get("work_model", "Unknown"),
        source_class=metadata.get("source_class", "Unknown"),
        capture_method=metadata.get("capture_method", "Unknown"),
        why_captured=sections.get("Why Captured", []),
        extracted_facts=sections.get("Extracted Facts", []),
        primary_match=primary_match,
        track_family=infer_track_family(primary_match, title),
        initial_fit_score=initial_fit_score,
        initial_fit_score_value=parse_fit_score(initial_fit_score),
        initial_decision=initial_decision,
        main_risk=main_risk,
        application_status=application_status,
        applied_at=applied_at,
        materials_used=materials_used,
        tracking_note=tracking_note,
        is_applied=infer_applied(application_status),
    )


def load_records() -> list[JobRecord]:
    records: list[JobRecord] = []
    for path in sorted(JOBS_DIR.glob("*.md")):
        if path.name in IGNORED_FILES:
            continue
        records.append(parse_job_record(path))
    return sorted(
        records,
        key=lambda item: (item.initial_fit_score_value or -1.0, item.captured_at),
        reverse=True,
    )


def serialize_records(
    records: list[JobRecord],
    record_url_builder: Callable[[JobRecord], str],
) -> list[dict[str, object]]:
    serialized: list[dict[str, object]] = []
    for record in records:
        item = asdict(record)
        item["record_url"] = record_url_builder(record)
        serialized.append(item)
    return serialized


HTML_TEMPLATE = """<!doctype html>
<html lang=\"tr\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>Job Search Workflow Job Dashboard</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0b1020;
      --panel: #151c33;
      --panel-2: #1d2745;
      --text: #edf2ff;
      --muted: #b7c3e0;
      --border: #31406a;
      --accent: #7dd3fc;
      --good: #86efac;
      --warn: #fcd34d;
      --bad: #fca5a5;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    a { color: var(--accent); }
    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }
    h1, h2, h3 { margin: 0 0 12px; }
    p { margin: 0 0 12px; color: var(--muted); }
    .summary-grid,
    .filter-grid {
      display: grid;
      gap: 12px;
    }
    .summary-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin: 20px 0;
    }
    .filter-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      align-items: end;
    }
    .card,
    .filters,
    .table-wrap {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .card { padding: 16px; }
    .card strong {
      display: block;
      font-size: 1.5rem;
      margin-bottom: 4px;
    }
    .filters {
      padding: 16px;
      margin-bottom: 16px;
      position: sticky;
      top: 12px;
      z-index: 2;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
    }
    input,
    select {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text);
    }
    .filter-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .button,
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text);
      cursor: pointer;
      text-decoration: none;
    }
    .button:hover,
    button:hover {
      background: rgba(125, 211, 252, 0.12);
    }
    .status {
      margin: 10px 0 16px;
      font-size: 0.95rem;
      color: var(--muted);
    }
    .detail-panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .detail-header,
    .detail-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .detail-actions {
      justify-content: flex-start;
      margin-top: 16px;
    }
    .detail-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin: 16px 0;
    }
    .detail-meta {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
    }
    .detail-meta strong,
    .detail-block strong {
      display: block;
      margin-bottom: 6px;
    }
    .detail-block { margin-top: 16px; }
    .detail-block ul {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
    }
    .detail-block li + li { margin-top: 8px; }
    .subtle-button { background: transparent; }
    .mobile-list {
      display: none;
      margin-bottom: 16px;
    }
    .job-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .job-card.selected-row { background: rgba(125, 211, 252, 0.12); }
    .job-card-head,
    .job-card-links,
    .job-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .job-card-links,
    .job-card-actions {
      justify-content: flex-start;
      margin-top: 12px;
    }
    .job-card-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      margin-top: 12px;
    }
    .job-card-grid div {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
    }
    .job-card-grid strong {
      display: block;
      margin-bottom: 6px;
    }
    .table-wrap {
      overflow-x: auto;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1100px;
    }
    th,
    td {
      padding: 12px;
      vertical-align: top;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    th {
      background: var(--panel-2);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(125, 211, 252, 0.1);
      color: var(--text);
      white-space: nowrap;
    }
    .decision-good { color: var(--good); }
    .decision-warn { color: var(--warn); }
    .decision-bad { color: var(--bad); }
    .muted { color: var(--muted); }
    .links a { display: inline-block; margin-right: 10px; }
    .links button { margin-right: 10px; }
    .selected-row { background: rgba(125, 211, 252, 0.12); }
    tbody tr:hover { background: rgba(125, 211, 252, 0.06); }
    .empty-state {
      padding: 24px;
      color: var(--muted);
    }
    .section-lead {
      margin-bottom: 10px;
      color: var(--muted);
    }
    @media (max-width: 900px) {
      main { padding: 16px; }
      .filters {
        position: static;
        top: auto;
      }
      .table-wrap { display: none; }
      .mobile-list { display: block; }
      .detail-header { align-items: flex-start; }
    }
  </style>
</head>
<body>
  <main>
    <header id=\"top\">
      <h1>Job Search Workflow Job Dashboard</h1>
      <p>Read-only local dashboard. Canonical truth hâlâ <code>inbox/jobs/*.md</code>.</p>
    </header>

    <section aria-labelledby=\"summary-heading\">
      <h2 id=\"summary-heading\">Summary</h2>
      <div class=\"summary-grid\" id=\"summary-cards\"></div>
    </section>

    <section class=\"filters\" aria-labelledby=\"filter-heading\">
      <h2 id=\"filter-heading\">Filtreler</h2>
      <form id=\"filter-form\">
        <div class=\"filter-grid\">
          <div>
            <label for=\"search\">Search</label>
            <input id=\"search\" name=\"search\" type=\"search\" placeholder=\"Company, role, risk, match\" />
          </div>
          <div>
            <label for=\"company\">Company</label>
            <select id=\"company\" name=\"company\"></select>
          </div>
          <div>
            <label for=\"decision\">Decision</label>
            <select id=\"decision\" name=\"decision\"></select>
          </div>
          <div>
            <label for=\"track\">Track</label>
            <select id=\"track\" name=\"track\"></select>
          </div>
          <div>
            <label for=\"sort\">Sort</label>
            <select id=\"sort\" name=\"sort\">
              <option value=\"score_desc\">Score high to low</option>
              <option value=\"score_asc\">Score low to high</option>
              <option value=\"captured_desc\">Date new to old</option>
              <option value=\"captured_asc\">Date old to new</option>
              <option value=\"company_asc\">Company A-Z</option>
            </select>
          </div>
        </div>
        <div class=\"filter-actions\">
          <button type=\"reset\" id=\"reset-filters\">Clear filters</button>
          <a class=\"button\" href=\"#top\">Back to summary</a>
        </div>
      </form>
      <p class=\"status\" id=\"status\" aria-live=\"polite\"></p>
    </section>

    <section class=\"detail-panel\" aria-labelledby=\"detail-heading\">
      <div class=\"detail-header\">
        <div>
          <h2 id=\"detail-heading\">Selected record detail</h2>
          <p id=\"detail-subtitle\">Select a detail from a row. Dashboard context is preserved.</p>
        </div>
        <button type=\"button\" class=\"button subtle-button\" id=\"clear-selection\" hidden>Clear selection</button>
      </div>
      <div id=\"detail-empty\" class=\"muted\">No record selected yet.</div>
      <div id=\"detail-content\" hidden>
        <div class=\"detail-grid\" id=\"detail-meta\"></div>
        <section class=\"detail-block\">
          <strong>Why captured</strong>
          <ul id=\"detail-why\"></ul>
        </section>
        <section class=\"detail-block\">
          <strong>Extracted signals</strong>
          <ul id=\"detail-facts\"></ul>
        </section>
        <section class=\"detail-block\" id=\"detail-application-block\" hidden>
          <strong>Application status</strong>
          <ul id=\"detail-application\"></ul>
        </section>
        <div class=\"detail-actions\" id=\"detail-actions\"></div>
      </div>
    </section>

    <section class=\"mobile-list\" id=\"mobile-applied-section\" aria-labelledby=\"mobile-applied-heading\" hidden>
      <h2 id=\"mobile-applied-heading\">Applied · card view</h2>
      <p class=\"section-lead\">Submitted applications are kept separately.</p>
      <div id=\"mobile-applied\"></div>
      <div class=\"empty-state\" id=\"mobile-applied-empty-state\" hidden>No applied records matching filters.</div>
    </section>

    <section class=\"mobile-list\" aria-labelledby=\"mobile-list-heading\">
      <h2 id=\"mobile-list-heading\">Job records · card view</h2>
      <div id=\"mobile-jobs\"></div>
      <div class=\"empty-state\" id=\"mobile-empty-state\" hidden>No job records matching filters.</div>
    </section>

    <section class=\"table-wrap\" id=\"applied-section\" aria-labelledby=\"applied-heading\" hidden>
      <h2 id=\"applied-heading\">Applied</h2>
      <p class=\"section-lead\">Submitted application records.</p>
      <table>
        <thead>
          <tr>
            <th scope=\"col\">Record</th>
            <th scope=\"col\">Company / Role</th>
            <th scope=\"col\">Applied / Location</th>
            <th scope=\"col\">Track / Match</th>
            <th scope=\"col\">Score / Decision</th>
            <th scope=\"col\">Tracking</th>
            <th scope=\"col\">Links</th>
          </tr>
        </thead>
        <tbody id=\"applied-body\"></tbody>
      </table>
      <div class=\"empty-state\" id=\"applied-empty-state\" hidden>No applied records matching filters.</div>
    </section>

    <section class=\"table-wrap\" aria-labelledby=\"table-heading\">
      <h2 id=\"table-heading\">Job records</h2>
      <table>
        <thead>
          <tr>
            <th scope=\"col\">Record</th>
            <th scope=\"col\">Company / Role</th>
            <th scope=\"col\">Date / Location</th>
            <th scope=\"col\">Track / Match</th>
            <th scope=\"col\">Score / Decision</th>
            <th scope=\"col\">Risk</th>
            <th scope=\"col\">Links</th>
          </tr>
        </thead>
        <tbody id=\"jobs-body\"></tbody>
      </table>
      <div class=\"empty-state\" id=\"empty-state\" hidden>No job records matching filters.</div>
    </section>
  </main>

  <script>
    const JOBS = __DATA__;

    const companySelect = document.getElementById("company");
    const decisionSelect = document.getElementById("decision");
    const trackSelect = document.getElementById("track");
    const sortSelect = document.getElementById("sort");
    const searchInput = document.getElementById("search");
    const jobsBody = document.getElementById("jobs-body");
    const appliedBody = document.getElementById("applied-body");
    const statusEl = document.getElementById("status");
    const summaryCards = document.getElementById("summary-cards");
    const emptyState = document.getElementById("empty-state");
    const appliedEmptyState = document.getElementById("applied-empty-state");
    const mobileEmptyState = document.getElementById("mobile-empty-state");
    const mobileAppliedEmptyState = document.getElementById("mobile-applied-empty-state");
    const mobileJobs = document.getElementById("mobile-jobs");
    const mobileApplied = document.getElementById("mobile-applied");
    const appliedSection = document.getElementById("applied-section");
    const mobileAppliedSection = document.getElementById("mobile-applied-section");
    const filterForm = document.getElementById("filter-form");
    const detailSubtitle = document.getElementById("detail-subtitle");
    const detailEmpty = document.getElementById("detail-empty");
    const detailContent = document.getElementById("detail-content");
    const detailMeta = document.getElementById("detail-meta");
    const detailWhy = document.getElementById("detail-why");
    const detailFacts = document.getElementById("detail-facts");
    const detailApplicationBlock = document.getElementById("detail-application-block");
    const detailApplication = document.getElementById("detail-application");
    const detailActions = document.getElementById("detail-actions");
    const clearSelectionButton = document.getElementById("clear-selection");
    const sortLabels = {
      score_desc: "Score high to low",
      score_asc: "Score low to high",
      captured_desc: "Date new to old",
      captured_asc: "Date old to new",
      company_asc: "Company A-Z",
    };
    let selectedFilename = "";

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function decisionClass(decision) {
      const value = decision.toLowerCase();
      if (value.includes("not a fit") || value.includes("reject")) {
        return "decision-bad";
      }
      if (value.includes("apply") || value.includes("viable") || value.includes("applied")) {
        return value.includes("conditional") ? "decision-warn" : "decision-good";
      }
      return "decision-warn";
    }

    function fillSelect(element, values) {
      const options = ["<option value=''>All</option>"];
      for (const value of values) {
        options.push(`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`);
      }
      element.innerHTML = options.join("");
    }

    function uniqueSorted(values) {
      return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "en"));
    }

    function renderSummary(records, totalRecords) {
      const conditional = records.filter((item) => item.initial_decision.toLowerCase().includes("conditional")).length;
      const applied = records.filter((item) => item.is_applied).length;
      const avgScoreValues = records
        .map((item) => item.initial_fit_score_value)
        .filter((item) => typeof item === "number");
      const avgScore = avgScoreValues.length
        ? (avgScoreValues.reduce((sum, item) => sum + item, 0) / avgScoreValues.length).toFixed(1)
        : "-";

      const cards = [
        { label: "Shown records", value: `${records.length} / ${totalRecords}` },
        { label: "Unique company", value: String(uniqueSorted(records.map((item) => item.company)).length) },
        { label: "Applied", value: String(applied) },
        { label: "Conditional apply", value: String(conditional) },
        { label: "Average score", value: avgScore },
      ];

      summaryCards.innerHTML = cards.map((item) => `
        <article class="card">
          <strong>${escapeHtml(item.value)}</strong>
          <span class="muted">${escapeHtml(item.label)}</span>
        </article>
      `).join("");
    }

    function matches(record) {
      const company = companySelect.value;
      const decision = decisionSelect.value;
      const track = trackSelect.value;
      const search = searchInput.value.trim().toLowerCase();

      if (company && record.company !== company) return false;
      if (decision && record.initial_decision !== decision) return false;
      if (track && record.track_family !== track) return false;
      if (!search) return true;

      const haystack = [
        record.company,
        record.role_title,
        record.location,
        record.primary_match,
        record.main_risk,
        record.initial_decision,
        record.track_family,
        record.application_status,
        record.tracking_note,
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    }

    function sortRecords(records) {
      const sortValue = sortSelect.value || "score_desc";
      const sorted = [...records];
      sorted.sort((left, right) => {
        const leftScore = left.initial_fit_score_value ?? -1;
        const rightScore = right.initial_fit_score_value ?? -1;
        if (sortValue === "score_asc" && leftScore !== rightScore) return leftScore - rightScore;
        if (sortValue === "score_desc" && leftScore !== rightScore) return rightScore - leftScore;
        if (sortValue === "captured_asc") return left.captured_at.localeCompare(right.captured_at);
        if (sortValue === "captured_desc") return right.captured_at.localeCompare(left.captured_at);
        if (sortValue === "company_asc") {
          const companyCompare = left.company.localeCompare(right.company, "tr");
          if (companyCompare !== 0) return companyCompare;
        }
        if (left.is_applied != right.is_applied) return left.is_applied ? -1 : 1;
        if (leftScore !== rightScore) return rightScore - leftScore;
        return right.captured_at.localeCompare(left.captured_at);
      });
      return sorted;
    }

    function getFilteredRecords(records) {
      return sortRecords(records.filter(matches));
    }

    function buildList(items) {
      if (!items.length) {
        return "<li>Unknown</li>";
      }
      return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    }

    function renderDetail(record) {
      const hasSelection = Boolean(record);
      detailEmpty.hidden = hasSelection;
      detailContent.hidden = !hasSelection;
      clearSelectionButton.hidden = !hasSelection;

      if (!record) {
        detailSubtitle.textContent = "Select a detail from a row. Dashboard context is preserved.";
        detailMeta.innerHTML = "";
        detailWhy.innerHTML = "";
        detailFacts.innerHTML = "";
        detailApplication.innerHTML = "";
        detailApplicationBlock.hidden = true;
        detailActions.innerHTML = "";
        return;
      }

      detailSubtitle.textContent = `${record.company} · ${record.role_title}`;
      const detailCards = [
        ["Captured", record.captured_at],
        ["Location", record.location],
        ["Work model", record.work_model],
        ["Track", record.track_family],
        ["Score", record.initial_fit_score],
        ["Decision", record.initial_decision],
      ];
      if (record.is_applied) {
        detailCards.push(["Application", record.application_status]);
        detailCards.push(["Applied at", record.applied_at]);
      }
      detailMeta.innerHTML = detailCards.map((item) => `
        <article class="detail-meta">
          <strong>${escapeHtml(item[0])}</strong>
          <span>${escapeHtml(item[1])}</span>
        </article>
      `).join("");
      detailWhy.innerHTML = buildList(record.why_captured);
      detailFacts.innerHTML = buildList(record.extracted_facts);
      if (record.is_applied) {
        detailApplicationBlock.hidden = false;
        detailApplication.innerHTML = buildList([
          `Status: ${record.application_status}`,
          `Applied at: ${record.applied_at}`,
          `Materials used: ${record.materials_used}`,
          `Tracking note: ${record.tracking_note}`,
        ]);
      } else {
        detailApplicationBlock.hidden = true;
        detailApplication.innerHTML = "";
      }
      detailActions.innerHTML = `
        <a class="button" href="${escapeHtml(record.record_url)}" target="_blank" rel="noopener noreferrer">Raw record</a>
        <a class="button" href="${escapeHtml(record.source_url)}" target="_blank" rel="noopener noreferrer">Posting page</a>
        <a class="button" href="${escapeHtml(record.catalog_root_url)}" target="_blank" rel="noopener noreferrer">Catalog root</a>
      `;
    }

    function buildCardHtml(item) {
      const extraCard = item.is_applied ? `
        <div>
          <strong>Applied</strong>
          <span>${escapeHtml(item.applied_at)}</span>
        </div>` : "";
      const extraLinks = item.is_applied ? `<span class="badge">${escapeHtml(item.application_status)}</span>` : "";
      return `
        <article class="job-card ${item.filename === selectedFilename ? "selected-row" : ""}">
          <div class="job-card-head">
            <div>
              <strong>${escapeHtml(item.company)}</strong><br>
              <span>${escapeHtml(item.role_title)}</span>
            </div>
            <span class="badge">${escapeHtml(item.track_family)}</span>
          </div>
          <div class="job-card-grid">
            <div>
              <strong>Captured</strong>
              <span>${escapeHtml(item.captured_at)}</span>
            </div>
            <div>
              <strong>Location</strong>
              <span>${escapeHtml(item.location)}</span>
            </div>
            <div>
              <strong>Score</strong>
              <span>${escapeHtml(item.initial_fit_score)}</span>
            </div>
            <div>
              <strong>Decision</strong>
              <span class="${decisionClass(item.initial_decision)}">${escapeHtml(item.initial_decision)}</span>
            </div>
            <div>
              <strong>Main match</strong>
              <span>${escapeHtml(item.primary_match)}</span>
            </div>
            <div>
              <strong>Main risk</strong>
              <span>${escapeHtml(item.main_risk)}</span>
            </div>${extraCard}
          </div>
          <div class="job-card-actions">
            <button type="button" class="button subtle-button" data-select-record="${escapeHtml(item.filename)}">Detail</button>
            ${extraLinks}
          </div>
          <div class="job-card-links">
            <a href="${escapeHtml(item.record_url)}" target="_blank" rel="noopener noreferrer">Record</a>
            <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">Posting</a>
            <a href="${escapeHtml(item.catalog_root_url)}" target="_blank" rel="noopener noreferrer">Catalog</a>
          </div>
        </article>
      `;
    }

    function renderCardList(container, items, emptyEl) {
      if (!items.length) {
        container.innerHTML = "";
        emptyEl.hidden = false;
        return;
      }
      emptyEl.hidden = true;
      container.innerHTML = items.map((item) => buildCardHtml(item)).join("");
    }

    function syncStateToUrl() {
      const params = new URLSearchParams();
      if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
      if (companySelect.value) params.set("company", companySelect.value);
      if (decisionSelect.value) params.set("decision", decisionSelect.value);
      if (trackSelect.value) params.set("track", trackSelect.value);
      if (sortSelect.value && sortSelect.value !== "score_desc") params.set("sort", sortSelect.value);
      if (selectedFilename) params.set("selected", selectedFilename);
      const query = params.toString();
      const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, "", nextUrl);
    }

    function applyUrlState() {
      const params = new URLSearchParams(window.location.search);
      searchInput.value = params.get("search") ?? "";
      selectedFilename = params.get("selected") ?? "";

      const company = params.get("company") ?? "";
      const decision = params.get("decision") ?? "";
      const track = params.get("track") ?? "";
      const sort = params.get("sort") ?? "score_desc";

      if ([...companySelect.options].some((item) => item.value === company)) {
        companySelect.value = company;
      }
      if ([...decisionSelect.options].some((item) => item.value === decision)) {
        decisionSelect.value = decision;
      }
      if ([...trackSelect.options].some((item) => item.value === track)) {
        trackSelect.value = track;
      }
      sortSelect.value = sortLabels[sort] ? sort : "score_desc";
    }

    function renderTable(body, items, kind) {
      body.innerHTML = items.map((item) => {
        if (kind === "applied") {
          return `
            <tr class="${item.filename === selectedFilename ? "selected-row" : ""}">
              <td>
                <strong>${escapeHtml(item.filename)}</strong><br>
                <span class="muted">${escapeHtml(item.source_id)}</span>
              </td>
              <td>
                <strong>${escapeHtml(item.company)}</strong><br>
                ${escapeHtml(item.role_title)}
              </td>
              <td>
                <strong>${escapeHtml(item.applied_at)}</strong><br>
                ${escapeHtml(item.location)}
              </td>
              <td>
                <span class="badge">${escapeHtml(item.track_family)}</span><br>
                <span>${escapeHtml(item.primary_match)}</span>
              </td>
              <td>
                <strong>${escapeHtml(item.initial_fit_score)}</strong><br>
                <span class="${decisionClass(item.initial_decision)}">${escapeHtml(item.initial_decision)}</span>
              </td>
              <td>${escapeHtml(item.tracking_note)}</td>
              <td class="links">
                <button type="button" class="button subtle-button" data-select-record="${escapeHtml(item.filename)}">Detail</button>
                <a href="${escapeHtml(item.record_url)}" target="_blank" rel="noopener noreferrer">Record</a>
                <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">Posting</a>
                <a href="${escapeHtml(item.catalog_root_url)}" target="_blank" rel="noopener noreferrer">Catalog</a>
              </td>
            </tr>
          `;
        }
        return `
          <tr class="${item.filename === selectedFilename ? "selected-row" : ""}">
            <td>
              <strong>${escapeHtml(item.filename)}</strong><br>
              <span class="muted">${escapeHtml(item.source_id)}</span>
            </td>
            <td>
              <strong>${escapeHtml(item.company)}</strong><br>
              ${escapeHtml(item.role_title)}
            </td>
            <td>
              <strong>${escapeHtml(item.captured_at)}</strong><br>
              ${escapeHtml(item.location)}
            </td>
            <td>
              <span class="badge">${escapeHtml(item.track_family)}</span><br>
              <span>${escapeHtml(item.primary_match)}</span>
            </td>
            <td>
              <strong>${escapeHtml(item.initial_fit_score)}</strong><br>
              <span class="${decisionClass(item.initial_decision)}">${escapeHtml(item.initial_decision)}</span>
            </td>
            <td>${escapeHtml(item.main_risk)}</td>
            <td class="links">
              <button type="button" class="button subtle-button" data-select-record="${escapeHtml(item.filename)}">Detail</button>
              <a href="${escapeHtml(item.record_url)}" target="_blank" rel="noopener noreferrer">Record</a>
              <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">Posting</a>
              <a href="${escapeHtml(item.catalog_root_url)}" target="_blank" rel="noopener noreferrer">Catalog</a>
            </td>
          </tr>
        `;
      }).join("");
    }

    function renderAll() {
      const filtered = getFilteredRecords(JOBS);
      const applied = filtered.filter((item) => item.is_applied);
      const backlog = filtered.filter((item) => !item.is_applied);

      if (selectedFilename && !filtered.some((item) => item.filename === selectedFilename)) {
        selectedFilename = "";
      }

      renderSummary(filtered, JOBS.length);
      statusEl.textContent = `${filtered.length} / ${JOBS.length} records · ${applied.length} applied · ${backlog.length} job records · ${sortLabels[sortSelect.value]}.`;

      appliedSection.hidden = !applied.length;
      mobileAppliedSection.hidden = !applied.length;

      renderCardList(mobileApplied, applied, mobileAppliedEmptyState);
      renderCardList(mobileJobs, backlog, mobileEmptyState);

      appliedEmptyState.hidden = Boolean(applied.length);
      emptyState.hidden = Boolean(backlog.length);

      renderTable(appliedBody, applied, "applied");
      renderTable(jobsBody, backlog, "jobs");

      const selectedRecord = filtered.find((item) => item.filename === selectedFilename) ?? null;
      renderDetail(selectedRecord);
      syncStateToUrl();
    }

    const companies = uniqueSorted(JOBS.map((item) => item.company));
    const decisions = uniqueSorted(JOBS.map((item) => item.initial_decision));
    const tracks = uniqueSorted(JOBS.map((item) => item.track_family));

    fillSelect(companySelect, companies);
    fillSelect(decisionSelect, decisions);
    fillSelect(trackSelect, tracks);
    applyUrlState();
    renderAll();

    filterForm.addEventListener("input", () => renderAll());
    filterForm.addEventListener("reset", () => {
      window.requestAnimationFrame(() => {
        sortSelect.value = "score_desc";
        selectedFilename = "";
        renderAll();
      });
    });
    function handleSelection(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const filename = target.dataset.selectRecord;
      if (!filename) return;
      selectedFilename = filename;
      renderAll();
    }
    jobsBody.addEventListener("click", handleSelection);
    appliedBody.addEventListener("click", handleSelection);
    mobileJobs.addEventListener("click", handleSelection);
    mobileApplied.addEventListener("click", handleSelection);
    clearSelectionButton.addEventListener("click", () => {
      selectedFilename = "";
      renderAll();
    });
    window.addEventListener("popstate", () => {
      applyUrlState();
      renderAll();
    });
  </script>
</body>
</html>
"""


def html_document(data: list[dict[str, object]]) -> str:
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return HTML_TEMPLATE.replace("__DATA__", payload)


def record_url_for_server(record: JobRecord) -> str:
    return f"/records/{quote(record.filename)}"


def build_export_record_url_builder(output_path: Path) -> Callable[[JobRecord], str]:
    def _builder(record: JobRecord) -> str:
        target = JOBS_DIR / record.filename
        return os.path.relpath(target, start=output_path.parent)

    return _builder


def run_check() -> int:
    records = load_records()
    if not records:
        print("FAIL job_dashboard_check no_records")
        return 1

    required_fields = [
        "title",
        "company",
        "role_title",
        "source_url",
        "catalog_root_url",
        "initial_decision",
    ]
    for record in records:
        for field_name in required_fields:
            value = getattr(record, field_name)
            if not value or value == "Unknown":
                print(
                    "FAIL job_dashboard_check "
                    f"missing_field={field_name} file={record.filename}",
                )
                return 1
        if record.is_applied and record.applied_at == "Unknown":
            print(
                "FAIL job_dashboard_check "
                f"missing_field=applied_at file={record.filename}",
            )
            return 1

    print(f"PASS job_dashboard_check records={len(records)}")
    return 0


def export_html(output_path: Path) -> int:
    records = load_records()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = serialize_records(records, build_export_record_url_builder(output_path))
    output_path.write_text(html_document(data), encoding="utf-8")
    print(f"PASS job_dashboard_export path={output_path}")
    return 0


class DashboardHandler(BaseHTTPRequestHandler):
    def _send(
        self,
        body: bytes,
        content_type: str,
        status: HTTPStatus = HTTPStatus.OK,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/" or self.path == "/index.html":
            records = load_records()
            data = serialize_records(records, record_url_for_server)
            body = html_document(data).encode("utf-8")
            self._send(body, "text/html; charset=utf-8")
            return

        if self.path == "/api/jobs":
            records = load_records()
            data = serialize_records(records, record_url_for_server)
            body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
            self._send(body, "application/json; charset=utf-8")
            return

        if self.path.startswith("/records/"):
            filename = unquote(self.path.split("/records/", 1)[1])
            path = JOBS_DIR / filename
            if not path.is_file() or path.name in IGNORED_FILES:
                self._send(
                    b"Not Found",
                    "text/plain; charset=utf-8",
                    HTTPStatus.NOT_FOUND,
                )
                return
            self._send(path.read_bytes(), "text/markdown; charset=utf-8")
            return

        self._send(b"Not Found", "text/plain; charset=utf-8", HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        return


def serve(host: str, port: int) -> int:
    server = ThreadingHTTPServer((host, port), DashboardHandler)
    print(f"Job Search Workflow dashboard running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nDashboard stopped.")
    finally:
        server.server_close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Job Search Workflow local job dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--export-html", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if args.check:
        return run_check()

    if args.export_html is not None:
        return export_html(args.export_html)

    if args.json:
        records = load_records()
        data = serialize_records(records, build_export_record_url_builder(ROOT))
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0

    return serve(args.host, args.port)


if __name__ == "__main__":
    sys.exit(main())
