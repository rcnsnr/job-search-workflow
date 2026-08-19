# Getting Started with Job Search Workflow Community Edition

This guide walks you through your first job triage, CV generation, and tracking
— on macOS, Linux, or Windows.

> **New here?** Read the [README](../../README.md) first for the project overview.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Your First Triage](#your-first-triage)
- [Generate a Tailored CV](#generate-a-tailored-cv)
- [Track in the Dashboard](#track-in-the-dashboard)
- [Run Workflow Guards](#run-workflow-guards)
- [Use the Career Pages Directory](#use-the-career-pages-directory)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

You need:

- **Python 3.10+**
- **An AI coding assistant** (Claude, Codex, Cursor, Windsurf, etc.)
- **pdflatex** (for CV PDF generation)
- **pandoc** (for DOCX generation)
- **Git** (to clone the repo)
- **Node.js 22.12+** (for extension tooling and repository checks)

### Install by Operating System

#### macOS

```bash
# Python and Git (usually pre-installed, or use Homebrew)
brew install python git

# LaTeX for PDF generation
brew install --cask mactex

# Pandoc for DOCX
brew install pandoc

# Node.js (required by repository setup and extension checks)
brew install node

# Verify
python3 --version
pdflatex --version
pandoc --version
```

#### Linux (Ubuntu/Debian)

```bash
# Python, Git, Node.js
sudo apt update
sudo apt install python3 python3-pip python3-venv git nodejs npm

# LaTeX
sudo apt install texlive-latex-extra

# Pandoc
sudo apt install pandoc

# Verify
python3 --version
pdflatex --version
pandoc --version
```

#### Linux (Fedora/RHEL)

```bash
sudo dnf install python3 python3-pip git nodejs texlive-latex pandoc
```

#### Windows

1. **Python**: Download and install from [python.org](https://python.org).
   Check "Add Python to PATH" during installation.
2. **Git**: Download from [git-scm.com](https://git-scm.com).
3. **LaTeX**: Install [MiKTeX](https://miktex.org/download) or
   [TeX Live](https://tug.org/texlive/).
4. **Pandoc**: Install from [pandoc.org](https://pandoc.org/installing.html)
   or with `winget install pandoc`.
5. **Node.js**: Download from [nodejs.org](https://nodejs.org) or
   run `winget install OpenJS.NodeJS` in PowerShell.

Verify in PowerShell:

```powershell
python --version
pdflatex --version
pandoc --version
```

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/rcnsnr/job-search-workflow.git
cd job-search-workflow
```

On Windows, the same commands work in PowerShell or Git Bash.

### 2. Create Your Personal Data Directory

This directory is **gitignored** and stays on your machine.

```bash
# macOS / Linux
cp -r templates/user-data-skeleton/ user_data/

# Windows (PowerShell)
Copy-Item -Recurse templates/user-data-skeleton/ user_data/

# Windows (Command Prompt)
xcopy templates/user-data-skeleton\ user_data\ /E /I
```

### 3. Install Python Dependencies

```bash
# macOS / Linux
pip3 install -r requirements.txt

# Windows
python -m pip install -r requirements.txt
```

If you want the dashboard, you are all set. `requirements.txt` already
includes FastAPI, Uvicorn, and Jinja2.

### 4. (Optional) Install Markdown Linter

```bash
# macOS / Linux
npm install -g markdownlint-cli2

# Windows
npm install -g markdownlint-cli2
```

---

## Your First Triage

The framework uses `modes/` files as structured prompts. You paste the
content of a mode file into your AI assistant, then paste the job posting
under it.

### Step 1: Fill Your Profile

Open `user_data/career_profile.md` in your AI assistant and replace the
placeholders with your real experience, skills, and preferences.

Do the same for `user_data/target_roles.md` with your role, location, and
deal-breaker preferences.

### Step 2: Find a Job Posting

Copy a job posting that interests you. You can use:

- The [Career Pages Directory](../../data/career-pages/companies.yaml) for direct
  company career pages
- LinkedIn, Indeed, or any public job board
- A job posting someone shared with you

### Step 3: Run the Triage Mode

1. Open `modes/01_JOB_TRIAGE.md`.
2. Copy the entire file.
3. Paste it into your AI assistant.
4. Add:

   ```text
   Here is the job posting I want to evaluate:
   ---
   [paste the posting here]
   ```

5. The AI returns a structured evaluation with:
   - fit score
   - risks (ghost, exploitation, chaos)
   - compensation signal
   - recommendation (reject / shortlist / apply)

### Step 4: Save the Result

If the role is viable, save the posting and triage result in `inbox/jobs/`.
You can create a file like:

```text
inbox/jobs/2026-07-24-company-role-title.md
```

Use the same markdown structure as the sample fixtures in `fixtures/`.

---

## Generate a Tailored CV

For roles you want to apply to:

1. Open `modes/05_DOCUMENT_OUTPUT.md`.
2. Copy and paste it into your AI assistant.
3. Provide:
   - your `user_data/career_profile.md`
   - the job posting
   - the triage result
4. The AI outputs a tailored LaTeX CV and a cover letter.

### Export to PDF

If the AI gives you a `.tex` file, save it to `exports/` and run:

```bash
# macOS / Linux
pdflatex -output-directory=exports exports/your-cv.tex

# Windows (PowerShell or CMD)
pdflatex -output-directory=exports exports\your-cv.tex
```

### Export to DOCX

The repository does not bundle a personal DOCX style template. Place a template
you have the right to use at `exports/cv-reference.docx`, save the generated CV
content as `exports/your-cv.md`, and run:

```bash
# macOS / Linux
pandoc exports/your-cv.md -o exports/your-cv.docx \
  --reference-doc=exports/cv-reference.docx

# Windows (PowerShell)
pandoc exports\your-cv.md -o exports\your-cv.docx `
  --reference-doc=exports\cv-reference.docx

# Windows (CMD)
pandoc exports\your-cv.md -o exports\your-cv.docx ^
  --reference-doc=exports\cv-reference.docx
```

---

## Track in the Dashboard

The optional Community Operations Desk turns local Markdown files into a
responsive overview, pipeline, searchable job inventory, profile view, and
scoring reference.

### Start the Dashboard

```bash
# macOS / Linux
python3 -m jsw dashboard

# Windows
python -m jsw dashboard
```

Open `http://localhost:3000` in your browser.

### What You Can Do

- Review a compact **workspace overview** and attention list
- View the responsive **pipeline**: new → triage → shortlist → applied →
  interview → offer/reject
- Search and filter the local **jobs inventory**
- View your **profile**
- Inspect **job postings**
- Review **scoring configuration** and job signals
- Choose a light or dark theme; light is the default

The dashboard reads only from your local Markdown files and does not transmit
them. A separate cloud AI assistant may process anything you choose to paste
into that service, so review its privacy terms independently.

---

## Run Workflow Guards

Before saving or advancing a job record, use the read-only workflow guards to
check duplicate identity, form-field limits, lifecycle metadata, and your own
eligibility policy:

```bash
python3 scripts/workflow_guard.py --help
```

See the [Workflow Guards guide](WORKFLOW_GUARDS.md) for configuration examples
and result meanings. The guards report problems but never submit an
application, move a record, or make a decision for you.

---

## Use the Career Pages Directory

A curated list of 50+ tech company career pages with ATS provider, location
policy, and last verified date.

Browse it directly:

```bash
cat data/career-pages/companies.yaml
```

Or verify the links are still alive:

```bash
# macOS / Linux
python3 scripts/verify_career_pages.py

# Windows
python scripts\verify_career_pages.py
```

Add new companies by editing `data/career-pages/companies.yaml` and opening a
pull request. See `data/career-pages/README.md` for the schema.

---

## Next Steps

| If you want to... | Use this |
| --- | --- |
| Evaluate more postings | `modes/01_JOB_TRIAGE.md` |
| Tailor your CV | `modes/02_RESUME_ATS.md` |
| Optimize LinkedIn | `modes/03_LINKEDIN_PROFILE.md` |
| Draft recruiter messages | `modes/04_RECRUITER_OUTREACH.md` |
| Find job sources | `modes/06_PUBLIC_SOURCE_DISCOVERY.md` |
| Contribute | [CONTRIBUTING.md](../../CONTRIBUTING.md) |

---

## Troubleshooting

### `pdflatex` not found

Make sure you installed a full TeX distribution (MacTeX, MiKTeX, or TeX
Live). `tinytex` or minimal distributions may be missing required packages
like `tgheros`, `enumitem`, or `needspace`.

### `python3 -m jsw dashboard` fails

Check that you installed dependencies:

```bash
pip3 install -r requirements.txt
```

If `python3` is not available on Windows, use `python` or `py`.

### AI does not follow the mode structure

Make sure you paste the **entire** `modes/01_JOB_TRIAGE.md` file, not just
the heading. The file contains explicit instructions for the AI.

### Markdown lint errors

If you contribute changes, run:

```bash
npx markdownlint-cli2 "**/*.md" "#**/node_modules/**"
```

---

## Data Privacy Reminder

Your personal data lives in `user_data/`, `inbox/`, `runs/`, `outputs/`, and
`exports/`. These directories are gitignored by default. Never commit real
personal information to the repository.

If you want to back up your data, copy the directories above to a private
location outside the repository.

Community Edition is source-available for noncommercial use. Read
[Commercial Use and SaaS Boundary](../../COMMERCIAL_USE.md) before sharing,
redistributing, or integrating the code into another product.
