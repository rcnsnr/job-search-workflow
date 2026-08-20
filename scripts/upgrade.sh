#!/usr/bin/env bash
# Create a lossless release upgrade beside the current workspace.
# Usage: ./scripts/upgrade.sh [vX.Y.Z] [--source /path/to/current-workspace]

set -euo pipefail

UPSTREAM_URL="https://github.com/rcnsnr/job-search-workflow.git"
UPSTREAM_API="https://api.github.com/repos/rcnsnr/job-search-workflow/releases/latest"
PERSONAL_DIRECTORIES=(user_data inbox exports outputs runs)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

fail() {
    echo "[ERROR] $*" >&2
    exit 1
}

usage() {
    echo "Usage: $0 [vX.Y.Z] [--source /path/to/current-workspace]"
    echo "Creates a backup and a separate release clone without changing this workspace."
}

latest_release_tag() {
    python3 - "$UPSTREAM_API" <<'PY'
import json
import sys
from urllib.request import urlopen

with urlopen(sys.argv[1], timeout=20) as response:
    payload = json.load(response)
tag = payload.get("tag_name")
if not isinstance(tag, str):
    raise SystemExit("GitHub did not return a release tag")
print(tag)
PY
}

validate_tag() {
    [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

copy_personal_directories() {
    local source="$1"
    local destination="$2"
    local directory

    for directory in "${PERSONAL_DIRECTORIES[@]}"; do
        if [[ -e "$source/$directory" ]]; then
            cp -a "$source/$directory" "$destination/$directory"
            echo "Copied personal directory: $directory"
        fi
    done
}

TAG=""
SOURCE_ROOT="$DEFAULT_SOURCE_ROOT"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --source)
            [[ $# -ge 2 ]] || fail "--source requires a workspace path."
            SOURCE_ROOT="$2"
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        v*)
            [[ -z "$TAG" ]] || fail "Only one release tag is accepted."
            TAG="$1"
            shift
            ;;
        *) fail "Unknown argument: $1" ;;
    esac
done

SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd)"
PARENT_DIR="$(cd "$SOURCE_ROOT/.." && pwd)"
if [[ -z "$TAG" ]]; then
    TAG="$(latest_release_tag)"
fi

[[ -f "$SOURCE_ROOT/README.md" ]] || fail "Repository root could not be verified."
[[ -d "$SOURCE_ROOT/.git" ]] || fail "Run this script from a Git clone."
validate_tag "$TAG" || fail "Release tag must use vX.Y.Z format; received: $TAG"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$PARENT_DIR/job-search-workflow-backups/$STAMP-$TAG"
RELEASE_DIR="$PARENT_DIR/job-search-workflow-$TAG"

[[ ! -e "$BACKUP_DIR" ]] || fail "Backup path already exists: $BACKUP_DIR"
[[ ! -e "$RELEASE_DIR" ]] || fail "Release path already exists: $RELEASE_DIR"

mkdir -p "$BACKUP_DIR"
echo "Creating backup at: $BACKUP_DIR"
copy_personal_directories "$SOURCE_ROOT" "$BACKUP_DIR"

echo "Cloning $TAG into: $RELEASE_DIR"
git clone --branch "$TAG" --single-branch "$UPSTREAM_URL" "$RELEASE_DIR"

echo "Copying personal data into the new release workspace..."
copy_personal_directories "$SOURCE_ROOT" "$RELEASE_DIR"

echo "Checking the new release prerequisites..."
"$RELEASE_DIR/scripts/setup.sh" --check-only

cat <<EOF
PASS upgrade
Backup: $BACKUP_DIR
New workspace: $RELEASE_DIR
Original workspace: $SOURCE_ROOT

Your original workspace was not changed. To start the new dashboard:
  cd "$RELEASE_DIR"
  python3 -m pip install -e ".[dashboard]"
  python3 -m jsw dashboard
EOF
