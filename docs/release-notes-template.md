# Release Notes Template

Copy this template into every GitHub release body. Replace the bracketed text
and keep the upgrade link unchanged so users always reach the current procedure.

```md
## Highlights

- [User-visible change]

## Upgrade safely

Follow the [current upgrade procedure](https://github.com/rcnsnr/job-search-workflow/blob/main/docs/UPGRADING.md) before updating an existing clone or fork.

## Validation

- [Checks run for this release]

## Scope and license

This is a source-only GitHub release. No private workspace data is included.
Community Edition is source-available for noncommercial use under PolyForm
Noncommercial 1.0.0; commercial use requires a separate written agreement.
```

The release-policy workflow verifies the exact upgrade-guide URL whenever a
GitHub release is published or edited. A failed check means the release is not
verified until its notes are corrected and the workflow passes.
