# Source Discovery Operations

## Purpose

Use public sources to find candidate postings, verify them manually, and save
factual local records for later triage. This flow does not apply, submit, or
make a career decision automatically.

## Inputs

- Your local `user_data/target_roles.md`
- [Public Job Sources](../sources/public-job-sources.md)
- [Source Discovery Query Pack](../sources/source-discovery-query-pack.md)
- A browser for checking the employer or ATS page

## Workflow

1. Read your target roles, required criteria, and avoid signals.
2. Choose one public source and one bounded query.
3. Open each result in the browser and confirm the role-specific page is live.
4. Record the title, company, location, work model, source URL, and check date.
5. Save the posting under `inbox/jobs/` using a clear Markdown filename.
6. Run `python3 scripts/workflow_guard.py --help` and select the relevant
   read-only checks.
7. Use `modes/01_JOB_TRIAGE.md` for the manual decision step.

## Safety Boundary

- Do not bypass authentication, paywalls, bot challenges, rate limits, or
  access controls.
- Do not store cookies, tokens, sessions, or unrelated personal data.
- Do not treat a search snippet as proof that a posting is still live.
- Do not auto-apply or promote a posting to an application state.
- Keep personal criteria and captured postings in gitignored local folders.

## Completion Record

For each discovery pass, record the source, query, check date, number reviewed,
number saved, and any access limitation. A zero-result pass is still useful when
the query and boundary are recorded honestly.
