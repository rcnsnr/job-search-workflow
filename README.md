# CareerOps Public Framework

> Status: Preparing for public release. This directory is not yet an independent, publication-ready public repository.

CareerOps is intended to become a reusable framework that contains no personal data. It is designed to run career triage, document-generation standards and public job-source discovery workflows using data supplied by the user.

## Quick Start

1. After the independent public repository is released, clone it:

   ```bash
   git clone https://github.com/<owner>/<repo>.git
   cd <repo>
   ```

2. Check the prerequisites first:

   - Linux/macOS: `./scripts/setup.sh --check-only`
   - Windows CMD: `scripts\setup.bat --check-only`

3. Run the setup:

   - Linux/macOS: `./scripts/setup.sh`
   - Windows CMD: `scripts\setup.bat`

4. When sample fixtures are available, replace the copies under `user_data/` with your own verified information.

Read the [Setup and Verification Guide](docs/setup-and-verification.md) for the detailed behavior contract, support matrix and troubleshooting steps.

For source discovery, see the [Public Job Sources Quickstart](docs/sources/public-job-sources.md), the
[Source Discovery Query Pack](docs/sources/source-discovery-query-pack.md), and
[Source Discovery Operations](docs/runbooks/source-discovery-operations.md).

## Requirements

Required:

- Git
- Python 3.10+
- Node.js 18+
- npm

Optional:

- `pandoc` - DOCX export
- `pdflatex` - PDF export
- `markdownlint-cli2` - local Markdown checks
- `shellcheck` - Bash static analysis

The setup scripts do not install missing system packages automatically and do not request administrator privileges.

## Directory Structure

- `user_data/` - local, user-specific career data
- `inbox/jobs/` - raw job-posting captures
- `runs/` - disposable analyses
- `outputs/` - cleaned, reusable outputs
- `exports/` - final application documents
- `modes/` - task-specific operating modes (job triage, source discovery, etc.)
- `scripts/` - setup and verification tools
- `tests/` - behavior tests
- `docs/` - usage and operations guides
- `docs/sources/` - public-safe source discovery quickstart and example catalog
- `docs/runbooks/` - repeatable operational procedures
- `tools/browser-extension/` - `Job Search Workflow Capture` browser extension source
- `fixtures/` - fictitious sample data to be added later

## Browser Extension

The `Job Search Workflow Capture` browser extension captures job postings from
LinkedIn Jobs and exports them as CareerOps Markdown/JSONL, CSV, or JSON. It can
also send postings to a local FastAPI capture server that writes directly to
`inbox/jobs/` for unattended workflows.

- Install: `docs/runbooks/browser-extension-install.md`
- Capture server setup: `docs/runbooks/capture-server-setup.md`
- Integration contract: `docs/integration/job-search-workflow.md`
- Extension source: `tools/browser-extension/`

Extension validation:

```bash
cd tools/browser-extension
npm install
npm test
npm run lint
node scripts/validate-manifest.js
```

## Verification

From the public repository root on Linux or macOS:

```bash
bash -n scripts/setup.sh
shellcheck scripts/setup.sh
python3 -m unittest discover -s tests -v
markdownlint-cli2 "**/*.md"
./scripts/setup.sh
```

The GitHub Actions workflow runs the Linux static and behavior checks and a real Windows CMD smoke test as separate jobs. Windows support is not considered verified unless the Windows job passes.

## Security and Privacy

- Content under `user_data/`, `inbox/jobs/`, `runs/`, `outputs/` and `exports/` is excluded by `.gitignore`.
- `.gitignore` alone does not guarantee prevention of personal-data leaks.
- Before public release, run deterministic PII and secret scans, perform a manual content review, verify licensing and confirm that the Git history is clean.
- This framework does not guarantee employment, interviews or offers.

See `.github/workflows/clone-scan.yml` for the CI definition.
