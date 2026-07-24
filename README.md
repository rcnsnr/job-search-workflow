# job-search-workflow

> **Job hunting shouldn't be a full-time job.**
> **They have ATS. You have Job Search Workflow.**

Companies use Applicant Tracking Systems (ATS) to filter you out before a human
ever sees your application. Many employers use Applicant Tracking Systems (ATS) to sort and screen applications before human review. Greenhouse reported that, in any given quarter in 2024, **18-22% of jobs posted on its platform were classified as ghost jobs**. This is platform-specific industry data, not an official estimate for the entire labor market.

`job-search-workflow` is a local-first, AI-assisted framework that helps you run
your job search like an engineering project — with triage, scoring, decision
records, and structured application materials. 

## The Problem It Solves

If you've ever job-hunted, you know the pain:

- You apply to 50 roles and hear back from 3. The rest vanish into a black hole.
- You spend hours tailoring a CV for a role that turns out to be a ghost job.
- You can't remember which companies you've already applied to.
- You have no system to compare offers or track decisions over time.
- You feel like job hunting *is* your full-time job.

This framework gives you a structured workflow instead of chaos:

- **Triage before you apply**: Score every posting against your criteria before
  investing time. Reject ghost jobs, unsustainable roles, and bad fits early.
- **Generate tailored applications**: CV (LaTeX → PDF), cover letters, and
  application answers — all aligned to the specific posting.
- **Track everything**: Decision records, application ledger, and evaluation
  index so you never lose track of where you stand.
- **Discover sources systematically**: Curated career pages, public job boards,
  and RSS feeds — no scraping, no bypassing login walls.
- **Assess relocation honestly**: Livability scoring for cross-border
  opportunities (cost of living, healthcare, childcare, safety).

## Who Is This For?

- **Engineers** (SRE, Platform, DevOps, AI/ML, Fullstack) who want a structured
  approach to job searching
- **Career changers** who need to evaluate roles against a changing skill matrix
- **Anyone tired** of applying into the void and getting no feedback

You don't need to be a developer to use this — but you do need an AI coding
assistant (Claude, Codex, Cursor, Windsurf, etc.) to run the workflow. The
`modes/` files are structured prompts that guide the AI through each task.

## Philosophy

1. **Honesty-first**: Never fabricate dates, metrics, titles, or experience.
   If evidence is missing, the framework says so explicitly.
2. **Local-first**:  No SaaS, no database, no
   third-party submissions without your explicit action.
3. **Methodology over tooling**: The value is in the decision framework and
   quality gates, not in a specific tool or platform.
4. **AI-assisted, human-decided**: AI helps draft, evaluate, and format. You
   make career decisions.

## Quick Start

### Prerequisites

- Python 3.10+
- An AI coding assistant (Claude, Codex, Cursor, Windsurf, etc.)
- `pdflatex` (TeX Live or similar) for CV PDF generation
- `pandoc` for DOCX generation
- Node.js (optional, for markdown linting)

### Setup (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/rcnsnr/job-search-workflow.git
cd job-search-workflow

# 2. Create your personal data directory (gitignored, never committed)
cp -r templates/user-data-skeleton/ user_data/

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. (Optional) Install markdown linting
npm install -g markdownlint-cli2
```

### First Steps

1. **Fill your profile**: Open `user_data/career_profile.md` in your AI
   assistant and fill it with your real experience, skills, and preferences.
   This is your source of truth — the AI will reference it for every task.

2. **Define your targets**: Edit `user_data/target_roles.md` with role types,
   locations, work models, and deal-breakers.

3. **Triage your first job posting**: Paste a job posting into your AI
   assistant and ask it to run `modes/01_JOB_TRIAGE.md`. You'll get a
   structured evaluation with a fit score, risks, and a recommendation.

4. **Generate a tailored CV**: For a viable role, ask the AI to run
   `modes/05_DOCUMENT_OUTPUT.md` to produce a LaTeX CV, cover letter, and
   application answers.

5. **Track your decision**: The AI records the outcome in your evaluation
   ledger so you can review it later.

## Project Structure

```text
job-search-workflow/
├── modes/                  # AI prompt contracts (triage, CV, outreach, etc.)
├── docs/
│   ├── runbooks/           # Step-by-step operational guides
│   ├── policies/           # Development and privacy standards
│   └── architecture/       # System design docs
├── scripts/                # Automation helpers (PDF validation, PII scan, etc.)
├── fixtures/               # Sample data (fictitious profiles, postings, CVs)
├── templates/
│   ├── user-data-skeleton/ # Blank starting point for your personal data
│   ├── wp-template.md      # Work Package spec template
│   └── cv-reference.docx   # Pandoc reference template for DOCX export
├── .github/workflows/      # CI pipeline (lint, PII scan, tests)
├── user_data/              # YOUR personal data (gitignored, never committed)
├── inbox/                  # Raw job postings you capture
├── outputs/                # Decision records, evaluations
├── exports/                # Final application materials (CV, cover letters)
└── runs/                   # One-off task outputs
```

## Modes (AI Prompt Contracts)

| Mode | Purpose |
| --- | --- |
| `01_JOB_TRIAGE` | Evaluate a job posting against your criteria |
| `02_RESUME_ATS` | Tailor CV/resume for a specific application |
| `03_LINKEDIN_PROFILE` | Optimize LinkedIn positioning |
| `04_RECRUITER_OUTREACH` | Draft recruiter messages |
| `05_DOCUMENT_OUTPUT` | Generate PDF/DOCX exports |
| `06_PUBLIC_SOURCE_DISCOVERY` | Find and catalog job sources |

## Key Design Decisions

- **CV export**: LaTeX `.tex` → `pdflatex` → PDF (ATS-optimized, no
  HTML-to-PDF tools). DOCX via `pandoc` with reference template.
- **No auto-apply**: This framework helps you prepare; it never submits
  applications on your behalf.
- **No scraping/bypass**: Job source discovery respects robots.txt, rate
  limits, and login walls.
- **PII boundary**: Personal data lives in `user_data/` (gitignored) and
  `exports/` (gitignored by default). The framework itself contains no
  real personal information.
- **Coğrafi maaş şeffaflığı**: Compensation scoring is market-aware. In markets
  where salary ranges are rarely published (e.g., Türkiye, India, Brazil),
  missing salary information does not penalize the score.

## Validation

```bash
# Check for accidentally committed personal data
python3 scripts/scan_pii.py

# Validate CV PDF standard compliance
python3 scripts/validate_pdf_standard.py exports/your-cv.pdf

# Run markdown linting
npx markdownlint-cli2 "**/*.md"

# Run tests
pytest
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. We welcome new modes,
runbook improvements, sample fixtures, and translations.

## Support This Project

This framework is built and maintained as an source-available side project. If it
saved you time, reduced your job-search stress, or helped you make a better
career decision, you can support continued development through any of these
channels:

- **GitHub Sponsors** (card / bank transfer):
  [github.com/sponsors/rcnsnr](https://github.com/sponsors/rcnsnr)
- **Solana (SOL) support address**:
  `FZv4G1131XNpvLgdEn4rDyZNKnAF3misVG9FmqA983Wp`
- **Litecoin (LTC) support address**:
  `ltc1qnn8dtgtv4p6eug6ttm3gm300lkm95hf9rdapkl`

> Crypto support addresses are personal self-custody wallets. SOL and LTC are
> chosen for their near-zero transaction fees, so even small support amounts
> arrive without being eaten by network costs. Contributions help cover
> development time, infrastructure costs, and keep this project free for
> individual job seekers.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — source-available, non-commercial.
Free for personal use, education, research, and individual job searching.
Commercial use (selling the Software, using it as a paid service/product, or
providing it as a for-fee consulting service) requires a separate commercial
license from the author.

## Disclaimer

This is a framework and methodology — not a job placement service. It does
not guarantee interviews, offers, or employment. Use it as a structured
approach to job searching, and always verify information independently.
