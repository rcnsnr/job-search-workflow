# Job Search Workflow Integration Contract

This document defines how the `Job Search Workflow Capture` browser extension,
the `public/scripts/linkedin_capture_server.py` FastAPI capture server, and the
CareerOps `inbox/jobs/` triage/decision/export pipeline fit together.

## Scope

- Extension (manual popup export or unattended scan)
- FastAPI local capture server
- `inbox/jobs/` Markdown intake
- Downstream triage → decision → export workflow

## Capture to Inbox Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│ LinkedIn Jobs page                                                  │
│  (content scripts read the DOM; no credentials are extracted)        │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Job Search Workflow Capture popup                                   │
│  • filter by keyword / location / company                           │
│  • export CareerOps Markdown / JSONL / CSV / JSON                   │
│  • or send to local capture server for unattended intake            │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌─────────────┐      ┌────────────────────────────┐
│ Manual      │      │ FastAPI capture server     │
│ export file │      │  POST /capture or /batch   │
└──────┬──────┘      │  writes inbox/jobs/*.md    │
       │              └────────────┬───────────────┘
       │                           │
       ▼                           ▼
┌─────────────────────────────────────────┐
│ CareerOps inbox/jobs/                   │
│  dedupe by source_url                   │
│  triage → decision → export             │
└─────────────────────────────────────────┘
```

## Capture Methods

### 1. Manual popup export

Use the extension popup to filter visible LinkedIn postings, then choose one of:

- **Download CareerOps Markdown** — a single `.md` file with English front-matter.
- **Download CareerOps JSONL** — one JSON object per line with normalized fields.
- **Copy Markdown** — copies the Markdown content to the clipboard.

The user then moves the downloaded file to `inbox/jobs/` (or copies the
clipboard content into a new file there). This is the default flow for users who
prefer full control and do not run the capture server.

### 2. Unattended scan via capture server

The options page can configure an unattended scan plan. When the scan runs, each
matching posting is POSTed to the local capture server:

```text
POST http://localhost:8766/capture
POST http://localhost:8766/batch
```

The server writes one Markdown file per posting to `inbox/jobs/`, deduplicating
by `source_url`.

## Endpoint Contract

### `GET /health`

Returns service status.

```json
{
  "status": "ok",
  "service": "job-search-workflow-capture"
}
```

### `POST /capture`

Write a single posting to `inbox/jobs/`.

Request body:

```json
{
  "source_id": "linkedin-20260725-abc123",
  "source_url": "https://www.linkedin.com/jobs/view/123456789/",
  "captured_at": "2026-07-25T12:00:00+00:00",
  "company": "Example Corp",
  "role_title": "Senior Platform Engineer",
  "location": "Remote - Europe",
  "work_model": "remote",
  "source_class": "linkedin_job",
  "capture_method": "unattended_scan",
  "why_captured": "SRE/Platform fit signals.",
  "extracted_facts": {
    "team_size": "10-15",
    "tech_stack": "Python, Kubernetes"
  },
  "fit_hypothesis": "Strong SRE background alignment."
}
```

Response `201` on first write, `200` on duplicate:

```json
{
  "saved": true,
  "source_id": "linkedin-20260725-abc123",
  "path": "/abs/path/to/inbox/jobs/2026-07-25-example-corp-senior-platform-engineer-linkedin-20260725-abc123.md"
}
```

### `POST /batch`

Write multiple postings in one request.

Request body:

```json
{
  "jobs": [
    { ...capture payload... },
    { ...capture payload... }
  ]
}
```

Response:

```json
{
  "results": [
    { "saved": true, "source_id": "...", "path": "..." },
    { "saved": false, "source_id": "...", "path": "...", "reason": "duplicate" }
  ]
}
```

### `GET /captures`

List captures since an ISO timestamp.

```text
GET /captures?since=2026-07-25T00:00:00+00:00
```

```json
{
  "captures": [
    {
      "filename": "2026-07-25-example-corp-senior-platform-engineer-linkedin-20260725-abc123.md",
      "source_id": "linkedin-20260725-abc123",
      "source_url": "https://www.linkedin.com/jobs/view/123456789/",
      "mtime": "2026-07-25T12:00:01.234567+00:00"
    }
  ]
}
```

## Normalized Posting Schema

The Markdown file written to `inbox/jobs/` has English front-matter and
Turkish prose sections to match CareerOps capture conventions
(GAP-20260622-02).

```markdown
---
source_id: linkedin-20260725-abc123
source_url: https://www.linkedin.com/jobs/view/123456789/
captured_at: 2026-07-25T12:00:00+00:00
company: Example Corp
role_title: Senior Platform Engineer
location: Remote - Europe
work_model: remote
source_class: linkedin_job
capture_method: unattended_scan
---

## Why Captured

SRE/Platform fit signals.

## Extracted Facts

- team_size: 10-15
- tech_stack: Python, Kubernetes

## Fit Hypothesis

Strong SRE background alignment.
```

### Front-matter fields

| Field | Type | Description |
| --- | --- | --- |
| `source_id` | string | Unique source identifier generated by the extension or server. |
| `source_url` | string | Canonical posting URL. Used for duplicate detection. |
| `captured_at` | string | ISO 8601 timestamp in UTC. |
| `company` | string | Company name. |
| `role_title` | string | Role title. |
| `location` | string | Raw location text from the posting. |
| `work_model` | string | Normalized work model: `remote`, `hybrid`, `onsite`, `Unknown`. |
| `source_class` | string | Taxonomy class, e.g. `linkedin_job` or `generic_job_board`. |
| `capture_method` | string | `manual_browser_extension_export` or `unattended_scan`. |

### Free-form sections

- `## Why Captured` — Turkish prose explaining why the posting was captured.
- `## Extracted Facts` — bullet list of structured facts extracted during capture.
- `## Fit Hypothesis` — Turkish prose describing the initial fit hypothesis.

## Deduplication

The capture server deduplicates by `source_url`. If a Markdown file in
`inbox/jobs/` already contains the same `source_url`, the new payload is not
written and the response returns `saved: false` with `reason: duplicate`.

The extension popup export does not deduplicate locally; deduplication happens
when the file is placed in `inbox/jobs/` by the server or by the triage script.

## Capture Server Configuration

Environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `CAREEROPS_INBOX_DIR` | `inbox/jobs` | Directory where capture Markdown files are written. |
| `CAREEROPS_CAPTURE_PORT` | `8766` | Port the FastAPI server listens on. `CAREEROPS_LINKEDIN_CAPTURE_PORT` is accepted as a legacy fallback. |

Start the server:

```bash
python3 public/scripts/linkedin_capture_server.py
```

Or with a custom inbox directory:

```bash
CAREEROPS_INBOX_DIR=/path/to/inbox/jobs python3 public/scripts/linkedin_capture_server.py
```

## Extension ↔ Server Wiring

The extension options page stores the capture server URL in
`chrome.storage.local`. The default is `http://localhost:8766`. The popup uses
this URL when the user clicks **Save & Scan** if unattended mode is enabled.

## Downstream Pipeline

After a file lands in `inbox/jobs/`, the CareerOps pipeline performs the
following steps:

1. **Normalize** — front-matter is parsed; free-form sections are kept as-is.
2. **Triage** — role fit, location/work-model gate, life fit, and compensation
   signals are evaluated.
3. **Decision** — a triage decision (`move_forward`, `watch`, `reject`) is
   recorded.
4. **Export** — tailored CV, cover letter, or outreach messages are produced
   for `move_forward` postings.

## Privacy and Security Notes

- The capture server binds to `127.0.0.1` by default; it is not exposed to the
  network unless explicitly configured otherwise.
- The extension does not send cookies, tokens, sessions, browser profiles, or
  private payloads to the server.
- Exported Markdown files contain only visible posting data and user-supplied
  profile hints.
