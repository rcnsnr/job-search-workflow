# Public Surface Sanitization Policy

This policy defines how Job Search Workflow Community Edition keeps its
standalone repository reusable, local-first, and free from unintended personal
or private material.

## Scope

The entire repository is public surface, including:

- source code under `dashboard/`, `scripts/`, and `tools/`
- tests and fictitious fixtures
- documentation and templates
- CI configuration and release artifacts
- root metadata such as `README.md` and `pyproject.toml`

Generated dependency trees, Git internals, caches, and binary release artifacts
are excluded from content scanning only when their source manifest or build
input remains scanned.

## Hard Constraints

### 1. No Unintended Personal Data

Public artifacts MUST NOT contain:

- private email addresses, phone numbers, national identifiers, or addresses
- owner home-directory paths or private repository slugs
- credentials, tokens, internal endpoints, or unpublished prompts
- real job-search records, application history, CVs, or decision records

Fictitious fixture identities and GitHub noreply maintainer addresses are
allowed. The maintainer's public name may appear in package metadata.

### 2. Community Edition Naming

- The user-facing framework name is `Job Search Workflow Community Edition`.
- `JSW Community Edition` may be used where space is constrained.
- The browser extension component remains `Job Search Workflow Capture`.
- Environment variables use the `JSW_` prefix.
- Retired private product names and owner-specific framework identifiers MUST
  NOT appear anywhere in the standalone repository.
- The CLI command remains `jsw`; this is a technical command, not a separate
  product name.

### 3. No Owner-Specific Defaults

Public templates, fixtures, and default settings MUST NOT encode a maintainer's
personal preferences:

- compensation defaults are null or explicitly fictitious
- location defaults are generic and belong only to sample fixtures
- company filters default to neutral values
- eligibility, work authorization, and relocation rules are user-configurable

### 4. Brand and Trademark Boundaries

- LinkedIn may appear in descriptions, help text, supported-site URLs, and host
  permissions where the extension actually integrates with LinkedIn Jobs.
- LinkedIn MUST NOT be used as the extension's main product name.
- Capture identifiers use generic JSW names rather than private or
  owner-specific identifiers.

### 5. Language Rule

User-facing Community Edition strings and public documentation are English.
Machine-readable source fields remain English. User-created local content may
use any language supported by the user's own workflow.

### 6. License and Commercial Boundary

- Community Edition is source-available under PolyForm Noncommercial 1.0.0; it
  MUST NOT be described as OSI-approved open source.
- The canonical `LICENSE` MUST remain byte-identical to the official PolyForm
  Noncommercial 1.0.0 plain text. Owner-specific notices belong in `NOTICE`.
- All first-party packages and release archives MUST carry the same
  noncommercial license identity and include `LICENSE` plus `NOTICE`.
- Commercial use requires a separate written agreement from the copyright
  holder. Community Edition does not grant rights to the separate private SaaS
  product, hosted infrastructure, private code, customer data, or non-public
  assets.
- Dependency license metadata describes third-party dependencies only and MUST
  NOT be presented as the license for first-party Community Edition code.

## Pre-Flight Checklist

Before any public commit, pull request, or release:

1. Run `npm ci`, `npm run lint`, `npm test`, and
   `node scripts/validate-manifest.js` under `tools/browser-extension/`.
2. Run `npm audit --audit-level=high` under `tools/browser-extension/`.
3. Run `python3 -m pytest -q`.
4. Run `python3 scripts/scan_pii.py --path .`.
5. Run `python3 scripts/check_secret_hygiene.py`.
6. Run `python3 scripts/check_linkedin_brand.py`.
7. Run `python3 scripts/verify_no_turkish.py --path .`.
8. Run `npx markdownlint-cli2 "**/*.md" "#**/node_modules/**"`.
9. Run `python3 scripts/check_license_policy.py`.
10. Review the diff and reachable Git metadata for unintended private material.

## CI Enforcement

`.github/workflows/ci.yml` runs deterministic pull-request checks. Scheduled
setup, career-page, and clone scans are separate because they validate
operational drift rather than duplicate the pull-request test suite.

A passing file scan proves only that configured patterns found no match in the
scanned tree. It does not prove that copies, forks, caches, or unrelated Git
history are erased.

## Release Policy

- GitHub releases require explicit human approval after the checklist passes.
- Chrome Web Store publication remains separately scoped and approved.
- Public pushes must use a GitHub noreply commit address and pass the repository
  privacy checks.

## Tools

- `scripts/scan_pii.py` scans an explicit root for personal and private
  references.
- `scripts/check_secret_hygiene.py` scans for common credential formats.
- `scripts/check_linkedin_brand.py` enforces extension brand boundaries.
- `scripts/verify_no_turkish.py` checks public-facing language consistency.
- `pytest`, `npm test`, and browser smoke checks cover runtime behavior.

## References

- `PUBLISH_CHECKLIST_EXTENSION.md`
- `.github/workflows/ci.yml`
- `docs/setup-and-verification.md`
