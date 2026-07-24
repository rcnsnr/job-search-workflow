# MODE: PUBLIC_SOURCE_DISCOVERY

## Purpose

Identify and maintain public sources for suitable SRE / DevOps /
Reliability / Observability roles.

Avoid unsafe scraping and personal-data leakage.

## Activation

Use when the user asks to:

- find job sources
- search public postings
- build a source list
- build or extend a source catalog
- create search prompts
- research potential role pipelines

Do not use this mode to evaluate a specific job post. Use job triage after a
posting is selected.

## Source Rules

- Prefer official career pages, reputable job boards, curated newsletters,
  RSS feeds, public search pages, and allowed APIs.
- Do not bypass login walls, paywalls, robots, rate limits, or anti-bot controls.
- Do not submit personal data, upload CVs, auto-apply, or message recruiters
  unless the user explicitly asks.
- Treat LinkedIn Premium or platform ranking as evidence signals only.
- Record provenance and access constraints in the source registry.
- Favor batch/bulk-friendly source structures over one-off opaque pages.
- Prefer row-level patches against `docs/sources/company-catalog-v1.csv` over
  narrative-only lists when the ask is catalog maintenance.
- Use `docs/sources/source-discovery-query-pack.md` and
  `docs/runbooks/source-discovery-operations.md` when the ask is recurring
  source expansion or refresh work.

## Fit Filters

Prioritize sources with filters for:

- [YOUR_PREFERRED_WORK_MODEL — e.g., remote, hybrid, timezone-compatible]
- [YOUR_PRIMARY_ROLE_TARGETS — from user_data/target_roles.md]
- [YOUR_SENIORITY_AND_WORKLOAD_PREFERENCES — e.g., senior IC, low on-call]
- [YOUR_DIFFERENTIATOR — what makes you stand out in your target roles]

Deprioritize sources dominated by:

- [ROLES_TO_AVOID_1 — e.g., US-only, strict US core hours]
- [ROLES_TO_AVOID_2 — e.g., role families outside your track]
- [ROLES_TO_AVOID_3 — e.g., heavy operational roles]
- [OTHER_DEAL_BREAKERS — from user_data/target_roles.md anti-patterns]

## Required Output Format

Use these sections:

- Reality Check
- Candidate Sources
- Catalog Strategy
- Search Prompts / Queries
- Intake Plan
- Do Not Do

For each candidate source, include:

- source name
- source class
- type
- access method
- best filters
- signal quality
- refresh cadence
- risks / limits
- status

When the task is recurring registry maintenance, also include:

- whether it should become a new catalog row
- priority tier
- stale / watchlist / deprecated recommendation
