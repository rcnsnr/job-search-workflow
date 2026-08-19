# Setup and Verification Guide

## Purpose

This guide explains what the setup scripts guarantee, which checks are automated and which claims require CI evidence.

The scripts do not invoke operating-system package managers automatically and do not request administrator privileges. They check system dependencies, report missing tools, create working directories and run available project validations in fail-closed mode.

## Support Matrix

| Environment | Entry point | Automated evidence |
| --- | --- | --- |
| Ubuntu Linux | `./scripts/setup.sh` | ShellCheck, Bash syntax, behavior tests and full smoke test |
| Windows Server | `scripts\setup.bat` | Full smoke test in GitHub Actions |
| macOS | `./scripts/setup.sh` | Bash-compatible design; best-effort support because no dedicated macOS CI job exists |

No absolute runtime guarantee is made. Confidence is bounded by static analysis, isolated behavior tests and the CI runs listed in the support matrix. Windows compatibility is not considered verified unless the GitHub Actions Windows job passes.

## Prerequisite Check

Linux or macOS:

```bash
./scripts/setup.sh --check-only
```

Windows CMD:

```bat
scripts\setup.bat --check-only
```

The check validates these required components:

- `README.md` and `.gitignore`
- Git
- Python 3.10 or newer
- Node.js 22.12 or newer
- npm

The Linux/macOS script also reports the optional `pandoc`, `pdflatex` and `markdownlint-cli2` tools. Missing optional tools do not block the basic setup, but the related document-export or lint capability will be unavailable.

## Full Setup

Linux or macOS:

```bash
./scripts/setup.sh
```

Windows CMD:

```bat
scripts\setup.bat
```

The full setup:

1. Creates `user_data/`, `inbox/jobs/`, `runs/`, `outputs/` and `exports/` idempotently.
2. Copies sample profile and target-role fixtures only when the destination file does not already exist.
3. Compiles files matching `scripts/*.py`.
4. Runs `npm ci` when a lock file exists, or `npm install` otherwise, when `package.json` exists.
5. Runs the configured npm test script and stops on failure.
6. Runs Markdown lint on Linux/macOS when the tool is available and stops on failure.
7. Stops when Git reports whitespace errors in the working tree.

The scripts do not overwrite existing user files. Unknown or excessive arguments are rejected with exit code `2` by the Bash entry point and a non-zero exit code by the Windows entry point.

## Browser Extension Setup

After the base setup is complete, install the browser extension in load-unpacked
mode:

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `tools/browser-extension/`.
4. Open the extension options to configure default filters, export format, and
   capture server URL.
5. Run the extension validation:

   ```bash
   cd tools/browser-extension
   npm test
   npm run lint
   node scripts/validate-manifest.js
   ```

See the extension-specific runbooks for more detail:

- `docs/runbooks/browser-extension-install.md`
- `docs/runbooks/capture-server-setup.md`
- `docs/integration/job-search-workflow.md`

## Local Audit Commands

Run these commands from the public repository root:

```bash
bash -n scripts/setup.sh
shellcheck scripts/setup.sh
python3 -m unittest discover -s tests -v
python3 -m pytest tests/test_linkedin_capture_server.py -q
markdownlint-cli2 "**/*.md"
./scripts/setup.sh --check-only
./scripts/setup.sh
git diff --check
```

## CI Evidence

`.github/workflows/clone-scan.yml` runs independent jobs for:

- Linux: Bash syntax, ShellCheck, Markdown lint, Python behavior tests and a full setup smoke test.
- Windows: a full `setup.bat` smoke test under real `cmd.exe`.

Required workflow steps do not suppress failures. A lint, test or setup failure fails the job.

## Behavior Tests

`tests/test_setup.py` executes the real Bash entry point in temporary, isolated repository copies and verifies that:

- The script can be called outside the repository root.
- `--help` succeeds.
- Unknown arguments are rejected.
- `--check-only` does not mutate the file system.
- A missing required repository file stops the check.
- Full setup is idempotent.
- An existing user profile is preserved.
- An invalid Python script stops setup in fail-closed mode.
- A failing npm test stops setup in fail-closed mode.

## Troubleshooting

- `Missing required tools`: Install the listed tools through a trusted package manager, then run `--check-only` again.
- `Python >= 3.10 is required`: Correct the active `python3` or `python` installation.
- `Node.js >= 18 is required`: Switch to a supported Node.js LTS release.
- Markdown lint failure: Correct the reported files instead of converting the failure into a warning.
- Windows CI failure: Fix the first failing command in the relevant GitHub Actions log. A Linux pass is not evidence of Windows compatibility.

## Security Boundary

The setup scripts do not request secrets, credentials or personal data. `user_data/` and generated work areas are covered by `.gitignore`, but ignore rules alone do not guarantee leak prevention. A separate PII and secret scan plus manual content review is required before public release.
