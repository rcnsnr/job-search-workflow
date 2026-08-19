# Changelog

This file records user-visible changes to Job Search Workflow Community
Edition. No stable release or tag is represented by the entries below.

## [Unreleased] - 2026-08-19

### Added

- Community Operations Desk with overview, pipeline, jobs, profile, and scoring
  views for local Markdown workspaces.
- Read-only workflow guards for duplicate detection, field limits, lifecycle
  checks, and configurable eligibility rules.
- Profile direction cards for target roles, must-haves, preferences, and avoid
  signals.
- Installable `jsw` command with local initialization, dashboard, and smoke
  checks.

### Changed

- Renamed the public user surface to Job Search Workflow Community Edition and
  the dashboard to Community Operations Desk.
- Adopted a light-first, responsive interface with optional dark mode and
  compact component radii.
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

### Security

- Added secret, brand, language, and deterministic license-policy checks.
- Replaced inconsistent first-party license metadata with the official
  PolyForm Noncommercial 1.0.0 boundary.
