#!/usr/bin/env python3
"""Fail-closed LinkedIn brand check for the public extension surface.

The public product name is "Job Search Workflow Capture". LinkedIn can appear
in subtitles, body text, and target-site URLs, but it must not be the main
product name in manifest.json, package.json, the extension popup/options title,
or the README level-1 heading. This script enforces that boundary.
"""

import json
import os
import re
import sys


def read_text(path: str) -> str:
    with open(path, encoding="utf-8") as file:
        return file.read()


def fail(message: str) -> None:
    print(f"❌ {message}", file=sys.stderr)


def main() -> int:
    base_dir = os.path.join(os.path.dirname(__file__), "..", "tools", "browser-extension")
    if not os.path.isdir(base_dir):
        fail(f"Extension directory not found: {base_dir}")
        return 1

    errors = 0

    # manifest.json name and description
    manifest_path = os.path.join(base_dir, "manifest.json")
    manifest = json.loads(read_text(manifest_path))
    for field in ("name", "description"):
        value = manifest.get(field, "")
        if re.search(r"\bLinkedIn\b", value, re.IGNORECASE):
            fail(f"manifest.json {field} contains LinkedIn as a main brand: {value!r}")
            errors += 1

    # package.json name
    package_path = os.path.join(base_dir, "package.json")
    package = json.loads(read_text(package_path))
    package_name = package.get("name", "")
    if re.search(r"\bLinkedIn\b", package_name, re.IGNORECASE):
        fail(f"package.json name contains LinkedIn: {package_name!r}")
        errors += 1

    # README level-1 heading
    readme_path = os.path.join(base_dir, "readme.md")
    if os.path.exists(readme_path):
        for line in read_text(readme_path).splitlines():
            if line.startswith("# "):
                heading = line.lstrip("# ").strip()
                if re.search(r"\bLinkedIn\b", heading, re.IGNORECASE):
                    fail(f"README level-1 heading contains LinkedIn: {heading!r}")
                    errors += 1
                break

    # popup.html title / main heading
    popup_html_path = os.path.join(base_dir, "popup.html")
    popup_html = read_text(popup_html_path)
    for pattern in (r"<title>.*?</title>", r"<h[12][^>]*>.*?</h[12]>"):
        for match in re.finditer(pattern, popup_html, re.IGNORECASE | re.DOTALL):
            text = re.sub(r"<[^>]+>", "", match.group(0))
            if re.search(r"\bLinkedIn\b", text, re.IGNORECASE):
                fail(f"popup.html main heading/title contains LinkedIn: {text.strip()!r}")
                errors += 1

    # options.html title / main heading
    options_html_path = os.path.join(base_dir, "options.html")
    options_html = read_text(options_html_path)
    for pattern in (r"<title>.*?</title>", r"<h[12][^>]*>.*?</h[12]>"):
        for match in re.finditer(pattern, options_html, re.IGNORECASE | re.DOTALL):
            text = re.sub(r"<[^>]+>", "", match.group(0))
            if re.search(r"\bLinkedIn\b", text, re.IGNORECASE):
                fail(f"options.html main heading/title contains LinkedIn: {text.strip()!r}")
                errors += 1

    if errors:
        print(f"\nLinkedIn brand check failed with {errors} error(s).", file=sys.stderr)
        return 1

    print("✅ LinkedIn brand check passed. LinkedIn is not used as the main product name.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
