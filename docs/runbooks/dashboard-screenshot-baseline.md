# Dashboard Screenshot Baseline

## Purpose

Keep the public dashboard preview current without publishing a personal
workspace. The repository carries a small, generic visual baseline for the
Community Operations Desk.

## Stable Assets

Refresh all five assets together when a public dashboard visual source changes:

- `assets/screenshots/dashboard-overview.png`
- `assets/screenshots/dashboard-pipeline.png`
- `assets/screenshots/dashboard-jobs.png`
- `assets/screenshots/dashboard-profile.png`
- `assets/screenshots/dashboard-scoring.png`
- `assets/screenshots/manifest.json`

These paths are intentionally stable. They can be embedded in documentation,
linked from release notes, or reused for a social post without creating dated
or duplicate image files.

## Capture Contract

- Use a clean public clone without `user_data/`, `inbox/`, `exports/`, or other
  personal workspace folders. The dashboard then uses its fictitious fixtures.
- Start the dashboard with `python3 -m jsw dashboard` after installing the
  dashboard extra.
- Capture each route at a `1920x1200` viewport in the default light theme as a
  full-page PNG.
- Overwrite the stable asset for `/`, `/pipeline`, `/jobs`, `/profile`, and
  `/scoring` respectively. Do not create date-stamped public variants.
- Increment `baseline_revision` in `assets/screenshots/manifest.json` after
  reviewing all five captures. This records a full recheck when one image has
  identical pixels and therefore no Git binary diff.
- Review the images before committing. They must not contain a real person,
  employer claim, confidential material, account identifier, or local path.

## Pull Request Gate

`scripts/check_dashboard_screenshot_coverage.py` compares the pull request
with its base commit. A change under `dashboard/static/`, `dashboard/templates/`,
or `dashboard/server.py` requires every stable screenshot to be updated in the
same change. When a recaptured image has identical pixels, the refreshed
manifest is the review receipt for that image.

Run the guard locally before opening a pull request:

```bash
python3 scripts/check_dashboard_screenshot_coverage.py --base origin/main
```

The guard verifies refresh coverage, not visual quality. A human review of the
five fixture images remains required.
