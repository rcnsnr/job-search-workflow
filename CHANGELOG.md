# Changelog

This file records user-visible changes to Job Search Workflow Community
Edition.

## [0.2.1] - 2026-08-20

### Upgrade Safety

- Added `upgrade.sh` and `upgrade.bat` for data-preserving updates. They create
  a dated backup, a separate tagged workspace, and copy personal records
  without changing the original clone or fork.
- Added a one-time bootstrap path for users upgrading from `v0.2.0` or earlier,
  where the upgrade scripts were not yet present.
- Every GitHub release note now links to the current upgrade procedure. A
  release-policy workflow verifies that link after publishing or editing a
  release.

## [0.2.0] - 2026-08-20

For upgrade instructions, see
[Upgrade Safely](docs/UPGRADING.md).

### Stable Release Additions

- A real, reusable `fixtures/sample-cv.pdf` generated from the tracked
  `fixtures/sample-cv.tex` source with the standard LaTeX export chain.
- A repository-wide publication checklist covering privacy, license, quality,
  documentation, release, and post-release verification.
- A stable public dashboard screenshot baseline that is refreshed whenever
  dashboard visuals change.

### Stable Release Changes

- The demo job's CV entry now opens the real public PDF fixture instead of a
  display-only placeholder.
- Updated package and dashboard metadata for the first stable source release.

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
