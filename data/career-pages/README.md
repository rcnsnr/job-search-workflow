# Career Pages Directory

A structured, machine-readable registry of company career pages with ATS
provider, location policy, and verification status.

## File

- `companies.yaml` — main registry (53 companies, seed data)

## Schema

Each company entry:

```yaml
- name: Company Name
  careers_url: https://example.com/careers
  ats_provider: greenhouse  # greenhouse|lever|ashby|workday|rippling|workable|personio|custom|unknown
  location_policy: remote   # remote|hybrid|onsite|mixed
  industry: ai_ml           # ai_ml|developer_tools|infrastructure|cloud|observability|data|security|fintech|productivity|automation|analytics
  company_size: small       # startup|small|medium|large|enterprise
  last_verified: "2026-07-23"
```

## Verification

Run the verification script to check for dead links:

```bash
python3 scripts/verify_career_pages.py
```

With `--update` to refresh `last_verified` dates for reachable URLs:

```bash
python3 scripts/verify_career_pages.py --update
```

CI runs a weekly verification job every Monday at 09:00 UTC.

## Contributing

Community PRs welcome. To add or update a company:

1. Add an entry to `companies.yaml` following the schema above.
2. Run `python3 scripts/verify_career_pages.py` to confirm the URL is live.
3. Set `last_verified` to today's date.
4. Open a PR.

## License

PolyForm Noncommercial 1.0.0 — see [LICENSE](../../LICENSE).
