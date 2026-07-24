# MODE: DOCUMENT_OUTPUT

## Purpose

Produce clean, ATS-safe, Markdown/LaTeX/DOCX-ready, LibreOffice-friendly, and PDF-export-friendly career documents.

## Activation

Use for:

- Markdown career files for project upload
- DOCX-ready document drafts
- LaTeX CV/resume source
- LibreOffice-friendly formatting
- PDF export preparation
- packaging career assets into reusable files

## User Preference

- Project files: Markdown preferred.
- Personal editing/export files: DOCX or LaTeX preferred.
- PDF: generated from DOCX or LaTeX.

## Formatting Rules

- Use common fonts: Arial, Calibri, Liberation Sans, Times New Roman, or equivalent.
- Use single-column layout for ATS CVs.
- No icons, logos, photos, decorative badges, complex tables, text boxes, or image-only contact data.
- Keep contact info as extractable text.
- Prefer standard headings and simple bullets.
- Avoid fragile spacing hacks.
- Avoid special glyph bullets if they may break in LibreOffice/PDF export.

## Markdown Rules

- Use clean headings.
- Use normal hyphen bullets.
- Keep tables simple; avoid wide tables unless necessary.
- Keep one fact per bullet where possible.
- Use `Unknown` for missing fields.

## Cover Letter Format (MANDATORY)

- Cover letter files are stored with `.md` extension but content is plain prose.
- Markdown markers are FORBIDDEN: `**bold**`, `*italic*`, `__underline__`, `## heading`, `# heading`, `` `code` ``, `> quote`, `- bullet`, `1. list`.
- Purpose: to be able to open the file and copy/paste all content directly into email body or ATS application form.
- Paragraphs are separated by blank lines; each paragraph stays on a single line.
- **HARD-LOCK — No artificial line wrapping:** in cover letter files, paragraphs and bullets are not divided line by line according to character limit. Each paragraph and each list item is written as a single, uninterrupted line; only blank lines are used between logical blocks. (GAP-20260718-01)
- **HARD-LOCK — No markdown emphasis/formatting markers in prose:** `**bold**`, `*italic*`, `__underline__`, heading, inline code, quote, and other markdown markers are not used within plain prose; emphasis is made only through natural sentence structure. (GAP-20260718-02)
- **Location / work-model paragraph (required for remote Europe/EMEA roles):** add the following plain text block or a similar expression in the first or last paragraph of the cover letter:

  ```text
  I am based in [CITY], [COUNTRY] ([TIMEZONE]) and work comfortably across [TIMEZONE_RANGE]. I am fully remote-native, async-first, and used to distributed teams across [REGION].
  ```

- Signature block is written as plain text.
- This rule does not apply to CV/resume files — CVs continue to use markdown headings and bullets.

## Application Form Answer Format (MANDATORY)

- ATS application form answers are also stored as `application-answers.md` (or role-specific naming).
- Answers may contain plain prose or numbered/bullet lists; **bold emphasis (`**bold**`), italic, underline, inline code, heading, quote, and other markdown formatting markers are FORBIDDEN**. Emphasis is made only through natural sentence structure.
- **HARD-LOCK — No artificial line wrapping:** each answer block, each paragraph, and each list item is written as a single, uninterrupted line. Line breaking according to character limit is strictly forbidden; only blank lines are used for paragraph/list/section separation. (GAP-20260718-01)
- **HARD-LOCK — No markdown emphasis/formatting markers in answers:** `**bold**`, `*italic*`, `__underline__`, heading, inline code, quote, and other markdown markers are not used within application answers. (GAP-20260718-02)
- Purpose: to ensure both that sentences are not broken when copy/pasting answers directly into ATS text boxes, and that ATS does not process markdown formatting characters as plain text.

## LaTeX Rules

- Prefer simple article class unless a specific CV template is requested.
- Avoid icon packages and photo layouts for ATS documents.
- Keep text copyable from generated PDF.
- Use clean section headings and itemize lists.
- Avoid over-compressed typography that hurts readability.

## PDF Generation Hard-Lock (MANDATORY — GAP-20260714-02)

**PDF generation MUST use the repo standard export chain:**

1. Write LaTeX `.tex` source using the standard template:
   - `\documentclass[10pt,a4paper]{article}`
   - `\usepackage[margin=0.6in]{geometry}`
   - `\usepackage[scale=0.95]{tgheros}` (ATS-neutral sans-serif)
   - `\usepackage{enumitem}` with compact spacing
   - `\usepackage[hidelinks]{hyperref}`
   - `\usepackage{needspace}` for orphan prevention
   - `\hyphenpenalty=10000` / `\exhyphenpenalty=10000` (no hyphenation)
   - `\raggedright`
2. Render with `pdflatex -interaction=nonstopmode <file>.tex`
3. Commit the `.tex` source alongside the `.pdf` for reproducibility

**FORBIDDEN methods for CV/resume PDF generation:**

- weasyprint (HTML→PDF)
- wkhtmltopdf (HTML→PDF)
- puppeteer / playwright PDF (browser→PDF)
- browser print-to-PDF
- Any HTML-to-PDF conversion tool

**Rationale:** HTML-to-PDF tools produce inconsistent typography, poor font
rendering, non-standard spacing, and lack the ATS-neutral formatting that
`pdflatex` + `tgheros` provides. The repo standard was established in
`WORKPACKAGE-EXPORT-HARDENING-01` receipts 9.5-9.7 and validated through
multiple export cycles.

**Validation:** `python3 scripts/validate_pdf_standard.py`

## DOCX Rules

- Use styles, not manual formatting everywhere.
- Keep one-column page flow.
- Avoid complex tables unless the user asks for a human-designed, non-ATS document.
- Verify LibreOffice rendering before final delivery when a DOCX is generated.
- **DOCX MUST be generated via `pandoc` with the reference template:**
  `pandoc <input>.md --reference-doc=exports/cv-variants-2026-06-21/cv-reference.docx -o <output>.docx`
  Direct `python-docx` generation is acceptable only for non-CV documents.

## Output Rule

When generating files, provide a download link and briefly state what is inside. Do not paste huge file contents unless requested.
