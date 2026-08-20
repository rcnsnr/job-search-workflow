# General Publish Checklist

Use this checklist for any public Job Search Workflow Community Edition release.
It covers the repository-wide source release; the browser extension has its
own additional checklist in `PUBLISH_CHECKLIST_EXTENSION.md`.

## Scope and Version

- [ ] Confirm the release contains only public, generic, source-available
  material. Do not add a personal workspace, user data, private notes, or
  private runtime configuration.
- [ ] Choose an unused semantic version and update `pyproject.toml`,
  `dashboard/server.py`, and `CHANGELOG.md` together.
- [ ] Confirm the release target is the current protected `main` commit.
- [ ] Write release notes that state the source-only scope and do not claim a
  hosted service, package-store publication, or commercial-use grant.

## Privacy and License

- [ ] `python3 scripts/scan_pii.py --path .` passes.
- [ ] `python3 scripts/check_secret_hygiene.py` passes.
- [ ] `python3 scripts/check_linkedin_brand.py` passes.
- [ ] `python3 scripts/verify_no_turkish.py --path .` passes.
- [ ] `python3 scripts/check_license_policy.py` passes.
- [ ] Review fixture names and contents. They must be fictional and must not
  imply endorsement, adoption, or employment by a real organization.

## Public Artifacts and Documentation

- [ ] If `fixtures/sample-cv.tex` changed, run
  `./scripts/build_sample_cv_fixture.sh` and commit the refreshed
  `fixtures/sample-cv.pdf` at the same path.
- [ ] `python3 scripts/validate_pdf_standard.py --public-fixture --strict`
  passes.
- [ ] `python3 scripts/check_sample_cv_fixture_coverage.py --base origin/main`
  passes.
- [ ] If dashboard visuals changed, refresh all five stable files under
  `assets/screenshots/` and run
  `python3 scripts/check_dashboard_screenshot_coverage.py --base origin/main`.
- [ ] `npx --yes markdownlint-cli2@0.20.0 "**/*.md" "#**/node_modules/**"`
  passes.
- [ ] Check README links, setup instructions, changelog entries, and release
  notes against the current repository behavior.

## Quality Gate

- [ ] `python3 -m compileall -q dashboard scripts tests` passes.
- [ ] `python3 -m ruff check dashboard scripts tests` passes.
- [ ] `python3 -m pytest -q` passes.
- [ ] `PYTHONPATH=scripts python3 -m jsw smoke` passes.
- [ ] In `tools/browser-extension/`, run `npm ci`, `npm run lint`,
  `node scripts/validate-manifest.js`, `npm test -- --runInBand`, and
  `npm audit --audit-level=high`.
- [ ] Review `git diff --check`, the staged file list, and the pull request
  diff for unintended public data.

## Protected Merge and Release

- [ ] Open a pull request to `main` and wait for every required hosted CI job.
- [ ] Merge only after GitHub reports the pull request is clean and mergeable.
- [ ] Dispatch the current `main` Setup Audit and require both Linux and
  Windows setup contracts to pass.
- [ ] Create a non-prerelease GitHub source release from the verified `main`
  commit. Do not retarget an existing release tag.
- [ ] Do not attach a wheel, installer, or extension archive unless a separate
  release scope explicitly authorizes it.

## Post-release Readback

- [ ] Confirm the tag and release resolve to the intended commit.
- [ ] Confirm the release is not marked draft or prerelease.
- [ ] Confirm no new open release-blocking pull request or issue was created.
- [ ] Record the release URL, commit, checks, and remaining non-release risks
  in the canonical private WP receipt.
