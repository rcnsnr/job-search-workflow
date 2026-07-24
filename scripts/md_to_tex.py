#!/usr/bin/env python3
"""Convert a markdown CV (repo .md format) to the standard LaTeX .tex source
that complies with GAP-20260714-02 (LaTeX .tex -> pdflatex -> PDF).

This is the legacy remediation converter for CVs that were originally produced
via DOCX -> LibreOffice PDF. It re-creates the .tex source so the PDF can be
regenerated through the repo standard export chain.

Usage:
    python3 scripts/md_to_tex.py <input.md> <output.tex>
    python3 scripts/md_to_tex.py --batch   # convert all legacy CVs missing .tex

Standard template: article, 10pt, A4, tgheros font, 0.6in margins, enumitem
compact spacing, hidelinks, needspace, no hyphenation.
"""

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

PREAMBLE = r"""% Auto-generated from markdown CV source via scripts/md_to_tex.py
% Standard repo export chain: LaTeX .tex -> pdflatex -> PDF (GAP-20260714-02)
\documentclass[10pt,a4paper]{article}
\usepackage[margin=0.6in]{geometry}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[scale=0.95]{tgheros}
\renewcommand{\familydefault}{\sfdefault}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{needspace}
\usepackage{parskip}
\usepackage{titlesec}

\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=1.2em,itemsep=0.15em,topsep=0.2em,parsep=0em}
\titleformat{\section}{\large\bfseries}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{0.7em}{0.35em}

% Disable hyphenation
\hyphenpenalty=10000
\exhyphenpenalty=10000
\raggedright

\begin{document}
"""

POSTAMBLE = r"\end{document}" + "\n"


def escape_latex(text: str) -> str:
    """Escape LaTeX special characters. Preserve **bold** markers for later."""
    # Protect **bold** segments first
    bold_segments = []

    def stash_bold(m):
        bold_segments.append(m.group(1))
        return f"\x00BOLD{len(bold_segments) - 1}\x00"

    text = re.sub(r"\*\*(.+?)\*\*", stash_bold, text)

    # Escape special chars (order matters: backslash last among literals)
    text = text.replace("\\", r"\textbackslash{}")
    text = text.replace("&", r"\&")
    text = text.replace("%", r"\%")
    text = text.replace("$", r"\$")
    text = text.replace("#", r"\#")
    text = text.replace("_", r"\_")
    text = text.replace("{", r"\{")
    text = text.replace("}", r"\}")
    text = text.replace("~", r"\textasciitilde{}")
    text = text.replace("^", r"\textasciicircum{}")

    # Restore bold segments as \textbf{...} (escaped)
    for i, seg in enumerate(bold_segments):
        seg_escaped = escape_latex(seg)
        text = text.replace(f"\x00BOLD{i}\x00", rf"\textbf{{{seg_escaped}}}")

    return text


def convert_inline(text: str) -> str:
    """Convert inline markdown to LaTeX (bold, links, dashes)."""
    text = escape_latex(text)
    # Convert " - " date/heading dash to " -- " (en-dash) for date ranges,
    # and " - " in titles to " --- " (em-dash). We handle this contextually
    # in the caller; here just normalize standalone hyphen spacing minimally.
    # Links: [text](url) -> \href{url}{text}
    text = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        r"\\href{\2}{\1}",
        text,
    )
    return text


def parse_frontmatter(lines: list[str]) -> tuple[dict, int]:
    """Parse YAML front-matter. Returns (fields, index_after).

    Robust to leading comment/blank lines before the opening '---' and to
    mildly malformed front-matter (collapsed title/author/date lines).
    """
    fields = {"title": "", "authors": [], "date": ""}
    # Skip leading comment/blank lines until the opening '---'
    start = 0
    while start < len(lines) and lines[start].strip() != "---":
        if lines[start].strip().startswith("<!--") or not lines[start].strip():
            start += 1
            continue
        break
    if start >= len(lines) or lines[start].strip() != "---":
        return fields, start
    idx = start + 1
    body = []
    while idx < len(lines) and lines[idx].strip() != "---":
        body.append(lines[idx])
        idx += 1
    idx += 1  # skip closing ---
    # crude YAML parse (defensive against collapsed lines)
    current_key = None
    for line in body:
        m = re.match(r"^(\w+):\s*(.*)$", line)
        if m and not line.startswith(" "):
            key, val = m.group(1), m.group(2).strip().strip('"')
            # Handle collapsed "title: X author:" lines
            if " author:" in val:
                val, _ = val.split(" author:", 1)
                current_key = "author"
            else:
                current_key = key
            if val:
                fields[key] = val
        elif line.strip().startswith("- ") and current_key == "author":
            entry = line.strip()[2:].strip().strip('"')
            # Handle collapsed author line with trailing 'date: "..."'
            dm = re.search(r'"\s+date:\s*"(.+)"$', entry)
            if dm:
                entry = entry[: dm.start()] + '"'
                fields["date"] = dm.group(1)
            elif ' date: "' in entry:
                entry, dpart = entry.split(' date: "', 1)
                fields["date"] = dpart.rstrip('"')
            entry = entry.strip().strip('"').strip()
            fields["authors"].append(entry)
    return fields, idx


def build_header(fields: dict) -> str:
    """Build the centered name/contact header from front-matter."""
    title = fields.get("title") or "Your Name"
    # authors: line1 = contact, line2 = linkedin/github
    authors = fields.get("authors", [])
    # Fallback to placeholder contact if front-matter authors missing/malformed
    if len(authors) < 2:
        authors = [
            "City, Country | your.email@example.com | +1-234-567-8900",
            "LinkedIn: linkedin.com/in/yourprofile | GitHub: github.com/youruser",
        ]
    date = fields.get("date", "")
    # Parse contact from authors
    line1 = authors[0] if len(authors) > 0 else ""
    line2 = authors[1] if len(authors) > 1 else ""
    # line1 format: "City, Country | email@example.com | +1-234-567-8900"
    # split by |
    parts = [p.strip() for p in line1.split("|")]
    out = "\\begin{center}\n{\\LARGE \\textbf{" + escape_latex(title) + "}}\\\\[0.3em]\n"
    if parts:
        # build contact line with mailto for email
        contact_bits = []
        for p in parts:
            if "@" in p:
                contact_bits.append(r"\href{mailto:" + p + "}{" + escape_latex(p) + "}")
            else:
                contact_bits.append(escape_latex(p))
        out += r" \,|\, ".join(contact_bits) + "\\\\\n"
    # line2: "LinkedIn: linkedin.com/in/yourprofile | GitHub: github.com/youruser"
    if line2:
        link_bits = []
        for seg in line2.split("|"):
            seg = seg.strip()
            m = re.match(r"(?i)(LinkedIn|GitHub):\s*(.+)", seg)
            if m:
                label = m.group(1)
                val = m.group(2).strip()
                url = val
                if not url.startswith("http"):
                    if "linkedin" in label.lower():
                        url = "https://" + val
                    else:
                        url = "https://" + val
                link_bits.append(r"\href{" + url + "}{" + escape_latex(val) + "}")
            else:
                link_bits.append(escape_latex(seg))
        out += r" \,|\, ".join(link_bits) + "\\\\[0.4em]\n"
    if date:
        out += "\\textbf{" + escape_latex(date) + "}\n"
    out += "\\end{center}\n"
    return out


def convert(md_path: Path) -> str:
    """Convert a .md CV to .tex source string."""
    raw = md_path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    fields, idx = parse_frontmatter(lines)
    body_lines = lines[idx:]

    tex = PREAMBLE
    tex += build_header(fields)

    current_section = ""
    in_itemize = False
    # For experience entries: track pending job title + meta line
    pending_title = None

    def close_itemize():
        nonlocal in_itemize
        if in_itemize:
            tex_add("\\end{itemize}\n")
            in_itemize = False

    # We'll build tex via a list for efficiency
    out_parts = [tex]

    def add(s):
        out_parts.append(s)

    # redefine close_itemize to use out_parts
    def close_itemize2():
        nonlocal in_itemize
        if in_itemize:
            add("\\end{itemize}\n\n")
            in_itemize = False

    i = 0
    while i < len(body_lines):
        line = body_lines[i]
        stripped = line.strip()

        # H2 section
        if stripped.startswith("## "):
            close_itemize2()
            pending_title = None
            sec = stripped[3:].strip()
            current_section = sec
            add("\\section*{" + escape_latex(sec) + "}\n")
            i += 1
            continue

        # H3 subsection
        if stripped.startswith("### "):
            close_itemize2()
            sub = stripped[4:].strip()
            if current_section == "Professional Experience":
                # job entry: title now, next non-empty non-# line is meta
                pending_title = sub
            elif current_section == "Selected Projects":
                # project entry: bold title + following bullets/desc
                add("\\textbf{" + convert_inline(sub) + "}\\\\\n")
            else:
                # competency subsection or other: bold subheading
                add("\\textbf{" + convert_inline(sub) + "}\n")
            i += 1
            continue

        # bullet
        if stripped.startswith("- "):
            if not in_itemize:
                # If we have a pending experience title, emit the job header first
                if pending_title is not None:
                    # look ahead for meta line already consumed? No—meta comes
                    # before bullets. We handle meta line below as non-bullet.
                    pass
                add("\\begin{itemize}\n")
                in_itemize = True
            item = stripped[2:].strip()
            add("\\item " + convert_inline(item) + "\n")
            i += 1
            continue

        # non-empty, non-heading, non-bullet line
        if stripped:
            # Continuation of a bullet: line is indented and we're in itemize
            if in_itemize and (line.startswith("  ") or line.startswith("\t")):
                add(convert_inline(stripped) + "\n")
                i += 1
                continue
            if pending_title is not None and current_section == "Professional Experience":
                # this is the "Company | Date | Location" meta line
                meta = stripped
                parts = [p.strip() for p in meta.split("|")]
                # parts: [Company, DateRange, Location]
                company = parts[0] if len(parts) > 0 else ""
                date_range = parts[1] if len(parts) > 1 else ""
                location = parts[2] if len(parts) > 2 else ""
                # normalize date " - " to " -- "
                date_range_tex = date_range.replace(" - ", " -- ")
                title_tex = convert_inline(pending_title)
                # " - " in title -> " --- "
                title_tex = re.sub(r" - ", " --- ", title_tex)
                add("\\needspace{8\\baselineskip}\n")
                add("\\textbf{" + title_tex + "} \\hfill \\textit{" + escape_latex(date_range_tex) + "}\\\\\n")
                loc_str = company
                if location:
                    loc_str += " | " + location
                add("\\textit{" + escape_latex(loc_str) + "}\n")
                pending_title = None
                i += 1
                continue
            # otherwise: paragraph text (summary, project description, training line)
            close_itemize2()
            add(convert_inline(stripped) + "\n\n")
            i += 1
            continue

        # empty line
        close_itemize2()
        i += 1

    close_itemize2()
    out_parts.append(POSTAMBLE)
    return "".join(out_parts)


def find_legacy_cvs_missing_tex() -> list[Path]:
    """Find CV .md files under exports/applications/ whose .pdf has no .tex."""
    apps = REPO_ROOT / "exports" / "applications"
    result = []
    for md in apps.rglob("*-cv-*.md"):
        stem = md.stem  # e.g. *-cv-polar-senior-platform-engineer
        tex = md.with_suffix(".tex")
        pdf = md.with_suffix(".pdf")
        if pdf.exists() and not tex.exists():
            result.append(md)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert markdown CV to standard LaTeX .tex")
    parser.add_argument("input", nargs="?", help="input .md file")
    parser.add_argument("output", nargs="?", help="output .tex file")
    parser.add_argument("--batch", action="store_true", help="convert all legacy CVs missing .tex")
    args = parser.parse_args()

    if args.batch:
        mds = find_legacy_cvs_missing_tex()
        if not mds:
            print("No legacy CVs missing .tex found.")
            return 0
        print(f"Found {len(mds)} legacy CV(s) missing .tex:")
        for md in mds:
            tex = md.with_suffix(".tex")
            tex.write_text(convert(md), encoding="utf-8")
            print(f"  WROTE {tex.relative_to(REPO_ROOT)}")
        return 0

    if not args.input or not args.output:
        parser.error("Provide input and output, or use --batch")
    inp = Path(args.input)
    outp = Path(args.output)
    outp.write_text(convert(inp), encoding="utf-8")
    print(f"WROTE {outp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
