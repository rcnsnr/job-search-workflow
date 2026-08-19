#!/usr/bin/env bash
# Job Search Workflow Community Edition - scripts/setup.sh
# Usage: ./scripts/setup.sh [--check-only]
#
# Checks prerequisites, creates missing local directories and sample fixtures,
# and runs the available project validations.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECK_ONLY=0

usage() { echo "Usage: $0 [--check-only]"; }
warn() { echo "[WARN] $*" >&2; }
fail() { echo "[ERROR] $*" >&2; }

case "${1:-}" in
    "") ;;
    --check-only) CHECK_ONLY=1 ;;
    --help|-h)
        usage
        exit 0
        ;;
    *)
        fail "Unknown argument: $1"
        usage >&2
        exit 2
        ;;
esac

if [[ $# -gt 1 ]]; then
    fail "Only one argument is accepted."
    usage >&2
    exit 2
fi

REQUIRED_DEPS=(git python3 node npm)
OPTIONAL_DEPS=(pandoc pdflatex markdownlint-cli2)
REQUIRED_FILES=(README.md .gitignore)
MISSING_REQUIRED=()
MISSING_OPTIONAL=()

cd "$REPO_ROOT"

echo "Starting the Job Search Workflow Community Edition setup check..."
echo "Repository root: $REPO_ROOT"

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$REPO_ROOT/$file" ]]; then
        fail "Required repository file is missing: $file"
        exit 1
    fi
done

for dep in "${REQUIRED_DEPS[@]}"; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        MISSING_REQUIRED+=("$dep")
    fi
done

for dep in "${OPTIONAL_DEPS[@]}"; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        MISSING_OPTIONAL+=("$dep")
    fi
done

if [[ ${#MISSING_REQUIRED[@]} -gt 0 ]]; then
    fail "Missing required tools: ${MISSING_REQUIRED[*]}"
    echo "Example installation commands:"
    echo "  Ubuntu/Debian: sudo apt-get install git python3 nodejs npm"
    echo "  macOS:         brew install git python3 node"
    exit 1
fi

echo "Required tools OK: ${REQUIRED_DEPS[*]}"

if [[ ${#MISSING_OPTIONAL[@]} -gt 0 ]]; then
    warn "Missing optional tools (CV export or lint may be unavailable): ${MISSING_OPTIONAL[*]}"
else
    echo "Optional tools OK"
fi

PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')

if [[ "$PY_MAJOR" -lt 3 || ("$PY_MAJOR" -eq 3 && "$PY_MINOR" -lt 10) ]]; then
    fail "Python >= 3.10 is required. Found: $PY_MAJOR.$PY_MINOR"
    exit 1
fi

echo "Python version OK: $PY_MAJOR.$PY_MINOR"

NODE_VERSION=$(node --version | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
NODE_MINOR=$(echo "$NODE_VERSION" | cut -d. -f2)

if [[ "$NODE_MAJOR" -lt 22 || ("$NODE_MAJOR" -eq 22 && "$NODE_MINOR" -lt 12) ]]; then
    fail "Node.js >= 22.12 is required. Found: $NODE_VERSION"
    exit 1
fi

echo "Node.js version OK: $NODE_VERSION"

if [[ "$CHECK_ONLY" -eq 1 ]]; then
    echo "Check-only mode: setup steps were skipped."
    echo "PASS setup-check"
    exit 0
fi

for dir in user_data inbox/jobs runs outputs exports; do
    if [[ ! -d "$REPO_ROOT/$dir" ]]; then
        mkdir -p "$REPO_ROOT/$dir"
        echo "Created directory: $dir"
    fi
done

if [[ -d "$REPO_ROOT/fixtures" ]]; then
    if [[ ! -f "$REPO_ROOT/user_data/career_profile.md" && -f "$REPO_ROOT/fixtures/sample-profile.md" ]]; then
        cp "$REPO_ROOT/fixtures/sample-profile.md" "$REPO_ROOT/user_data/career_profile.md"
        echo "Copied sample profile: user_data/career_profile.md"
    fi

    if [[ ! -f "$REPO_ROOT/user_data/target_roles.md" && -f "$REPO_ROOT/fixtures/sample-target_roles.md" ]]; then
        cp "$REPO_ROOT/fixtures/sample-target_roles.md" "$REPO_ROOT/user_data/target_roles.md"
        echo "Copied sample target roles: user_data/target_roles.md"
    fi
fi

if [[ -d "$REPO_ROOT/scripts" ]]; then
    shopt -s nullglob
    py_files=("$REPO_ROOT/scripts/"*.py)
    shopt -u nullglob
    if [[ ${#py_files[@]} -gt 0 ]]; then
        for py in "${py_files[@]}"; do
            python3 -m py_compile "$py" || { fail "Python compilation failed: $py"; exit 1; }
        done
        echo "Python scripts compiled successfully"
    fi
fi

if [[ -f "$REPO_ROOT/package.json" ]]; then
    if [[ -f "$REPO_ROOT/package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi

    npm run --if-present test
    echo "npm tests completed (when a test script was defined)"
fi

if command -v markdownlint-cli2 >/dev/null 2>&1; then
    markdownlint-cli2 "**/*.md"
else
    warn "markdownlint-cli2 was not found; lint was skipped"
fi

if [[ -d "$REPO_ROOT/.git" ]]; then
    git diff --check
fi

echo "PASS setup"
