# Changelog

This file records user-visible changes to Job Search Workflow Community
Edition.

## [0.1.0] - 2026-08-19

### Added

- Community Operations Desk with overview, pipeline, jobs, profile, and scoring
  views for local Markdown workspaces.
- Read-only workflow guards for duplicate detection, field limits, lifecycle
  checks, and configurable eligibility rules.
- Profile direction cards for target roles, must-haves, preferences, and avoid
  signals.
- Installable `jsw` command with local initialization, dashboard, and smoke
  checks.
- Persistent dashboard ownership and noncommercial-use notice.
- Posting-specific access to existing CV, cover-letter, and application-answer
  files, plus a richer fictitious pipeline for local demonstrations.
- Direct GitHub Sponsors access from the Community Edition overview.

### Changed

- Renamed the public user surface to Job Search Workflow Community Edition and
  the dashboard to Community Operations Desk.
- Adopted a light-first, responsive interface with optional dark mode and
  compact component radii.
- Replaced numeric-only quality-risk penalties with plain-language score
  explanations and an example calculation.
- Moved posting-specific application files into a responsive right rail on
  wide screens while preserving the single-column narrow layout.
- Consolidated pull-request checks for Python, documentation, privacy, and the
  browser extension.
- Clarified that Community Edition is source-available for noncommercial use
  and separate from the owner-operated commercial SaaS.

### Fixed

- Expanded PII scanning to the selected public tree and added regression tests.
- Corrected stale setup, workflow, package, extension, and release instructions.
- Fixed Python quality defects in the Markdown-to-LaTeX and language-checking
  utilities.
- Corrected setup fixture initialization and broken documentation links.
- Removed the hosted Linux setup audit's redundant package-mirror dependency.
- Removed raw frontmatter metadata from rendered job-detail content.

### Security

- Added secret, brand, language, and deterministic license-policy checks.
- Added an opt-in, receipt-bound pre-push entry point for guarded release
  delivery.
- Replaced inconsistent first-party license metadata with the official
  PolyForm Noncommercial 1.0.0 boundary.
