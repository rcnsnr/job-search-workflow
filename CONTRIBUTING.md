# Contributing to job-search-workflow

Thank you for your interest in contributing! This project aims to provide a
structured, honest, and reusable framework for AI-assisted job searching.

## How to Contribute

### Reporting Issues

- Use GitHub Issues for bug reports, feature requests, or documentation gaps.
- Include steps to reproduce for bugs.
- For security vulnerabilities, please email instead of opening a public issue.

### Pull Requests

1. Fork the repository and create a feature branch.
2. Follow existing code style and conventions.
3. Ensure all CI checks pass (`markdownlint`, `pytest`, PII scan).
4. Write or update tests for new functionality.
5. Keep PRs focused — one logical change per PR.

### What We Welcome

- New modes or runbook improvements
- Script enhancements (validation, export, automation)
- Sample fixtures (fictitious profiles, postings, CVs)
- Documentation clarity improvements
- Translations of modes/runbooks
- CI/CD pipeline improvements

### What We Don't Accept

- Real personal data in any form (names, emails, companies, dates)
- Auto-apply or scraping functionality
- Bypassing login walls, rate limits, or access controls
- Dependencies on proprietary SaaS backends

## Development Standards

- Python scripts follow PEP 8 and type hints where practical.
- Markdown follows `.markdownlint-cli2.jsonc` rules.
- CV generation uses LaTeX → pdflatex only (no HTML-to-PDF).
- DOCX generation uses pandoc with the reference template.
- All fixtures must use fictitious data only.

## PII Policy

**Critical**: No real personal information may be committed to this
repository. This includes:

- Real names, emails, phone numbers
- Real company names in evaluation/decision contexts
- Real application history or interview details
- Real GitHub/LinkedIn usernames

Use `python3 scripts/scan_pii.py` before committing to verify compliance.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
Be respectful, constructive, and inclusive.

## License

By contributing, you agree that your contributions will be licensed under the
[PolyForm Noncommercial 1.0.0](LICENSE) license.
