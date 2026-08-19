# Extension Phase 1 Release Checklist

Use this checklist before creating the Phase 1 GitHub release `.zip` for
`Job Search Workflow Capture`.

## Public-surface policy gate

Review `docs/policies/public-surface-sanitization.md` before starting the
release. The policy defines hard constraints for PII, brand boundaries,
owner-specific defaults, English-only public UI, and release approvals.

## Pre-release verification

- [ ] `npm test` passes from `tools/browser-extension/`.
- [ ] `npm run lint` passes from `tools/browser-extension/`.
- [ ] `node scripts/validate-manifest.js` passes from `tools/browser-extension/`.
- [ ] `npm audit --audit-level=high` reports no high or critical findings.
- [ ] `python3 -m pytest tests/test_linkedin_capture_server.py -q` passes.
- [ ] `python3 -m py_compile scripts/linkedin_capture_server.py` passes.
- [ ] `python3 scripts/scan_pii.py --path .` passes.
- [ ] `python3 scripts/check_linkedin_brand.py` passes.
- [ ] `npx markdownlint-cli2 "**/*.md"` passes.
- [ ] `.github/workflows/clone-scan.yml` YAML is valid.

## Build the Phase 1 load-unpacked `.zip`

Create a clean `.zip` from `tools/browser-extension/` excluding development
artifacts:

```bash
cd tools/browser-extension
zip -r ../../job-search-workflow-capture-v2.0.0.zip \
  manifest.json popup.html popup.js popup.css \
  options.html options.js options.css \
  service_worker.js icon.png readme.md \
  content/ utils/ scripts/ tests/ \
  package.json package-lock.json jest.config.js .eslintrc.json \
  -x "node_modules/*" -x "coverage/*" -x "*.log"
zip -j ../../job-search-workflow-capture-v2.0.0.zip \
  ../../LICENSE ../../NOTICE ../../COMMERCIAL_USE.md
```

Verify the `.zip` contents:

```bash
unzip -l job-search-workflow-capture-v2.0.0.zip
```

The archive must contain at minimum:

- `manifest.json`
- `popup.html`, `popup.js`, `popup.css`
- `options.html`, `options.js`, `options.css`
- `service_worker.js`
- `icon.png`
- `content/jobs.js`
- `content/autoscan.js`
- `utils/*.js`
- `scripts/validate-manifest.js`
- `readme.md`
- `LICENSE`, `NOTICE`, and `COMMERCIAL_USE.md`

## Create the GitHub release

1. Ensure the working tree is clean and the checklist above is complete.
2. Create a tag, for example `extension-v2.0.0`.
3. Create a GitHub release using that tag.
4. Attach `job-search-workflow-capture-v2.0.0.zip` to the release.
5. Include installation instructions and a link to
   `docs/runbooks/browser-extension-install.md`.

## Post-release

- [ ] Download the release `.zip` and confirm it loads unpacked in Chrome.
- [ ] Smoke-test the popup on a LinkedIn Jobs search page.
- [ ] Confirm Job Search Workflow Markdown export works.
- [ ] Confirm capture server intake works when the server is running.

## Phase 2: Chrome Web Store

Chrome Web Store listing is **out of scope** for this WP and requires a
separate user approval. It involves:

- $5 developer registration fee
- Privacy policy page
- Screenshots and store assets
- Chrome Web Store review

Do not proceed to Phase 2 without explicit approval.
