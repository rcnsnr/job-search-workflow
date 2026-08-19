# Source Discovery Query Pack

Use these templates to find public job postings without bypassing access
controls, login walls, rate limits, or site terms. Replace bracketed values with
your own criteria.

## Search Templates

### Company Career Pages

```text
site:[company-career-domain] ("[target role]" OR "[adjacent role]")
```

### Public ATS Pages

```text
site:boards.greenhouse.io OR site:jobs.ashbyhq.com OR site:jobs.lever.co
"[target role]" "[location or remote region]"
```

### Skills and Work Model

```text
"[target role]" "[required skill]" (remote OR hybrid) "[region]"
```

### Exclusion Pass

```text
"[target role]" "[region]" -intern -contract -"[excluded technology]"
```

## Review Checklist

1. Prefer the employer's official career page over search snippets.
2. Confirm that the posting title, location, and apply action are present.
3. Record the source URL and the date you checked it.
4. Save only the facts needed for your local workflow.
5. Run the read-only workflow guards before manual triage.
6. Stop if the site blocks access or requires automation that its terms do not
   permit.

See [Public Job Sources](public-job-sources.md) for starting points and
[Source Discovery Operations](../runbooks/source-discovery-operations.md) for
the complete local flow.
