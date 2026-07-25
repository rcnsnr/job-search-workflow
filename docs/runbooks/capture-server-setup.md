# Capture Server Setup Runbook

The `public/scripts/linkedin_capture_server.py` FastAPI server receives job
postings from the `Job Search Workflow Capture` extension and writes them as
Markdown files to `inbox/jobs/`.

## Prerequisites

- Python 3.10 or newer.
- FastAPI, Pydantic, PyYAML, and Uvicorn installed.

## Install dependencies

From the public repository root:

```bash
python3 -m pip install fastapi pydantic pyyaml uvicorn
```

Or use a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install fastapi pydantic pyyaml uvicorn
```

## Start the server

Default port `8766` and default inbox directory `inbox/jobs`:

```bash
python3 public/scripts/linkedin_capture_server.py
```

You should see output similar to:

```text
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8766 (Press CTRL+C to quit)
```

## Configure inbox directory

The server creates the inbox directory if it does not exist. Set a custom path
with the environment variable:

```bash
CAREEROPS_INBOX_DIR=/path/to/inbox/jobs python3 public/scripts/linkedin_capture_server.py
```

## Configure port

The default port is `8766`. Override it with:

```bash
CAREEROPS_CAPTURE_PORT=9000 python3 public/scripts/linkedin_capture_server.py
```

The legacy variable `CAREEROPS_LINKEDIN_CAPTURE_PORT` is also accepted for
backward compatibility.

## Verify the server

### Health check

```bash
curl http://localhost:8766/health
```

Expected response:

```json
{"status":"ok","service":"job-search-workflow-capture"}
```

### Capture a posting

```bash
curl -X POST http://localhost:8766/capture \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "test-001",
    "source_url": "https://www.linkedin.com/jobs/view/123456789/",
    "captured_at": "2026-07-25T12:00:00+00:00",
    "company": "Example Corp",
    "role_title": "Senior Platform Engineer",
    "location": "Remote - Europe",
    "work_model": "remote",
    "source_class": "linkedin_job",
    "capture_method": "unattended_scan",
    "why_captured": "SRE/Platform fit signals.",
    "extracted_facts": {"team_size": "10-15", "tech_stack": "Python, Kubernetes"},
    "fit_hypothesis": "Strong SRE background alignment."
  }'
```

Expected response on first write:

```json
{"saved":true,"source_id":"test-001","path":"/abs/path/to/inbox/jobs/2026-07-25-example-corp-senior-platform-engineer-test-001.md"}
```

### List captures

```bash
curl "http://localhost:8766/captures?since=2026-07-25T00:00:00+00:00"
```

### Batch capture

```bash
curl -X POST http://localhost:8766/batch \
  -H "Content-Type: application/json" \
  -d '{"jobs":[{"source_id":"test-002",...}, {"source_id":"test-003",...}]}'
```

## Wire the extension to the server

1. Install and open the extension options page.
2. Go to the **Unattended Scan** tab.
3. Set **Capture Server URL** to `http://localhost:8766`.
4. Save settings.
5. Click **Scan Now** or wait for the alarm interval.

## Run the capture server in the background

For long-running unattended scans, use a process manager:

```bash
nohup python3 public/scripts/linkedin_capture_server.py > logs/capture-server.log 2>&1 &
```

Or use `tmux`:

```bash
tmux new -s capture-server
python3 public/scripts/linkedin_capture_server.py
```

Detach with `Ctrl+b` then `d`.

## Stop the server

If you started it in the foreground, press `Ctrl+C`.

If you started it with `nohup`, find the process and stop it:

```bash
ps aux | grep linkedin_capture_server
kill <PID>
```

## Troubleshooting

### `ModuleNotFoundError: No module named 'fastapi'`

Install the dependencies listed in the prerequisites section.

### `Permission denied: inbox/jobs`

The server tries to create `inbox/jobs` relative to the current working
directory. Ensure the process has write permission or set `CAREEROPS_INBOX_DIR`
to a writable path.

### `Address already in use`

Another process is using port `8766`. Stop it or set `CAREEROPS_CAPTURE_PORT` to
a different port. Update the extension options to match.

### Captures are not appearing in `inbox/jobs/`

- Verify the server is running: `curl http://localhost:8766/health`.
- Check the extension options page for the correct server URL.
- Look at the server logs for `POST /capture` or `POST /batch` entries.
- Check that the extension has the `host_permissions` for `http://localhost:8766/*`.

### Duplicate captures are not written

This is expected. The server deduplicates by `source_url`. The response returns
`saved: false` and `reason: duplicate`.

## Security notes

- The server binds to `127.0.0.1` by default and should not be exposed to the
  public internet.
- Do not send cookies, tokens, sessions, or private payloads to the server.
- Keep the inbox directory outside public web roots.
