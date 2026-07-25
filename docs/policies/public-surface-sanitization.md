# Public Surface Sanitization Policy

This policy defines how the CareerOps repository produces a clean, reusable,
public-facing surface under `public/`. It covers source code, documentation,
fixtures, CI configuration, and release artifacts.

## Scope

The public surface includes everything that may be copied into a separate public
repository or released as a standalone artifact:

- `public/tools/browser-extension/`
- `public/scripts/`
- `public/tests/`
- `public/docs/`
- `public/.github/workflows/`
- `public/README.md` and `public/PUBLISH_CHECKLIST_EXTENSION.md`

## Hard Constraints

### 1. No Personal Data or Private References

Public artifacts MUST NOT contain:

- Real names, email addresses, phone numbers, or national ID numbers.
- Personal addresses, home directory paths, or usernames tied to the owner.
- Private repository slugs, internal endpoints, or unpublished prompts.
- Placeholder usernames such as `kullaniciadi` or `orcun`.

### 2. No Owner-Specific Defaults

Public templates, fixtures, and default settings MUST NOT encode owner
preferences:

- Minimum salary defaults MUST be `null` or a clearly fictitious value.
- Location defaults MUST be generic (e.g. `Remote, Berlin`) not tied to the
  owner.
- Company-origin filters MUST default to neutral (`any`) in public templates.
- `CareerOps` is the public framework name; profile labels MUST use
  `Example CareerOps Profile` or a similarly generic label.

### 3. Brand and Trademark Boundaries

- The public product name for the browser extension is
  `Job Search Workflow Capture`.
- `LinkedIn` MAY appear in descriptions, help text, target-site URLs, and
  host permissions because the extension operates on LinkedIn Jobs.
- `LinkedIn` MUST NOT be used as the main product name in `manifest.json`,
  `package.json`, popup/options titles, or README level-one heading.
- Private repo slugs such as `linkedin-job-filter` or `CareerOps-framework`
  MUST NOT appear in public files.
- Source identifiers and capture method names MUST use generic identifiers such
  as `job-search-workflow-capture` / `job_search_workflow_capture`, not
  `linkedin-manual-extension` or `linkedin_manual_extension_capture`.

### 4. Language Rule for Public UI

All user-facing strings in the public extension MUST be in English:

- HTML `lang` attribute MUST be `en`.
- UI labels, button text, placeholders, console comments, and test log
  messages MUST be English.
- Regex-based keyword detection MUST use English terms only (e.g. `remote`,
  `hybrid`, `office`, `onsite`).

Internal comments and variable names MAY remain English; Turkish comments MUST
be translated before public release.

### 5. Inbox Capture Language Rule

`inbox/jobs/` capture Markdown follows GAP-20260622-02:

- Structural front-matter fields are English for machine readability.
- Free-form prose sections are Turkish unless a downstream consumer requires
  otherwise.

## Pre-Flight Checklist

Before any public commit, pull request, or release:

1. Run `npm test` in `public/tools/browser-extension/` and confirm full parity.
2. Run `npm run lint` in `public/tools/browser-extension/`.
3. Run `node scripts/validate-manifest.js` in `public/tools/browser-extension/`.
4. Run `python3 -m pytest public/tests/test_linkedin_capture_server.py -q`.
5. Run `python3 public/scripts/scan_pii.py`.
6. Run `python3 public/scripts/check_linkedin_brand.py`.
7. Run `npx markdownlint-cli2` on changed Markdown files.
8. Review the diff manually for owner-specific strings, old private slugs, or
   leftover Turkish UI text.

## CI Enforcement

`public/.github/workflows/clone-scan.yml` runs the above checks in separate
jobs. Any failure blocks the workflow.

## Release Policy

- Phase 1 `.zip` releases require explicit human approval after the checklist
  is complete.
- Chrome Web Store (Phase 2) is out of scope for this policy and requires a
  separate approval.
- No `git push` to a public remote may happen without a passing guardian audit
  and, where required, the user's explicit sign-off.

## Tools

- `public/scripts/scan_pii.py` — fail-closed scanner for hard PII and private
  references.
- `public/scripts/check_linkedin_brand.py` — fail-closed check that LinkedIn
  is not used as the main product name.
- `npx markdownlint-cli2` — Markdown linting.
- `npm test` and `npm run lint` — extension tests and static checks.
- `pytest` and `py_compile` — Python server checks.

## References

- `public/PUBLISH_CHECKLIST_EXTENSION.md`
- `public/tools/browser-extension/tests/fixtures/SANITIZATION_INVENTORY.md`
- `AGENTS.md` GAP-20260622-02
