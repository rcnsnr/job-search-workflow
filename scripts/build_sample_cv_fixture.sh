#!/usr/bin/env bash
# Rebuild the one public CV fixture from its tracked LaTeX source.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/fixtures/sample-cv.tex"
OUTPUT="$ROOT/fixtures/sample-cv.pdf"
BUILD_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

if ! command -v pdflatex >/dev/null 2>&1; then
  echo "pdflatex is required to rebuild the public sample CV fixture." >&2
  exit 1
fi

pdflatex \
  -interaction=nonstopmode \
  -halt-on-error \
  -output-directory="$BUILD_DIR" \
  "$SOURCE" >/dev/null

install -m 0644 "$BUILD_DIR/sample-cv.pdf" "$OUTPUT"
echo "Rebuilt fixtures/sample-cv.pdf from fixtures/sample-cv.tex"
