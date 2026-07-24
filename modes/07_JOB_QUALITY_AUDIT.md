# Mode 07 — Job Quality Audit

## Purpose

Detect ghost jobs, exploitation patterns, and organizational chaos signals in
job postings before the user invests time in triage or application.

This mode is a semantic pre-filter. It runs before or alongside
`modes/01_JOB_TRIAGE.md` and produces risk signals that feed into the triage
decision record and dashboard badges (WP-14).

> AI produces signals; the human makes the final decision.

---

## When to Use

- Before triaging a job posting, run a quality audit to flag risks early.
- When a posting feels "off" (vague, too broad, reposted, overly aggressive
  language).
- Before investing time in CV tailoring or application form answers.
- Optional: user can skip this mode in triage if time is limited.

---

## Inputs

1. **Job posting text** (full description, requirements, benefits, company
   section).
2. **Company metadata** (optional, if available):
   - Funding stage, recent layoffs, stock trajectory
   - Employee count, growth rate
   - Glassdoor / Blind sentiment summary (if user provides)
3. **Posting metadata** (optional, if available):
   - Posting age (days since first published)
   - Repost count
   - Time-to-close for similar roles at the same company

If optional inputs are missing, the audit runs on posting text alone and marks
affected signals as `inferred_from_text_only`.

---

## Risk Categories

### 1. Ghost Job Risk

A ghost job is a posting that is not actively being filled. Common reasons:
talent pipeline building, internal candidate already selected, market testing,
or manager collecting resumes for future budget.

**Red flag signals (>=5 required for `high`):**

| Signal | Description |
|--------|-------------|
| `posting_age_90_plus` | Posting has been open 90+ days without closing |
| `repeated_repost` | Same role reposted multiple times within 6 months |
| `evergreen_language` | "Always hiring", "rolling applications", "ongoing" |
| `unicorn_skill_list` | Extremely broad skill requirements across unrelated domains |
| `vague_compensation` | No salary, no range, no equity mention despite market norm |
| `generic_description` | Copy-paste job description, no company-specific detail |
| `weak_company_signals` | Recent layoffs, stock decline, frozen headcount |
| `no_clear_hiring_manager` | No hiring manager named, no team description |
| `multiple_locations_listed` | 5+ locations listed without specifying which is primary |

**Risk levels:**

- `low`: 0-2 signals
- `medium`: 3-4 signals
- `high`: 5+ signals

### 2. Exploitation Risk

An exploitation job extracts disproportionate labor relative to compensation,
growth, or stability. The posting language reveals intent.

**Red flag signals (>=5 required for `high`):**

| Signal | Description |
|--------|-------------|
| `rockstar_ninja_language` | "Rockstar", "ninja", "wizard", "guru" in title or description |
| `wear_many_hats` | "Wear many hats", "jack of all trades", "generalist" as primary expectation |
| `heavy_oncall` | "Own the pager", 24/7 on-call, on-call rotation without compensation detail |
| `fast_paced_self_starter` | "Fast-paced" + "self-starter" + "thrives under pressure" combo |
| `low_salary_high_equity` | Below-market salary paired with vague equity promise |
| `family_language` | "We're a family", "work hard play hard", "we're all in this together" |
| `undefined_hours` | No core working hours specified, "flexible" used to mean "always available" |
| `unlimited_pto` | "Unlimited PTO" without accrual or minimum guarantee |
| `ownership_without_autonomy` | "Own X end-to-end" but no decision-making authority described |
| `contractor_disguised` | Full-time expectations on contractor / "freelance" terms |

**Risk levels:**

- `low`: 0-2 signals
- `medium`: 3-4 signals
- `high`: 5+ signals

### 3. Chaos Risk

A chaos job is at an organization in internal turmoil — high turnover,
leadership instability, or structural dysfunction that makes the role
unstable regardless of the posting's quality.

**Red flag signals (>=4 required for `high`):**

| Signal | Description |
|--------|-------------|
| `recent_leadership_change` | C-suite or VP-level departure within last 6 months |
| `pre_funding_chaos` | Role opened just before a funding round or restructuring |
| `toxic_reviews` | Glassdoor / Blind reviews mention "toxic", "burnout", "high turnover" |
| `rapid_repost` | Role reposted within 60 days of previous posting (turnover signal) |
| `hyper_growth_hiring` | 50+ open roles at a small company (<100 employees) |
| `role_reorg` | "Newly created team", "rebuilding", "restructuring" in description |
| `multiple_departures` | Multiple departures from the same team in recent months |
| `hiring_freeze_rumor` | Public signals of hiring freeze or budget cuts |

**Risk levels:**

- `low`: 0-1 signals
- `medium`: 2-3 signals
- `high`: 4+ signals

---

## Output Format

```markdown
# Job Quality Audit

## Posting
- **Company:** [company name]
- **Role:** [role title]
- **Location:** [location]
- **Posting age:** [days, or "Unknown"]
- **Source:** [LinkedIn / ATS / company career page]

## Risk Summary

| Category | Risk Level | Signal Count |
|----------|-----------|--------------|
| Ghost job | `low` / `medium` / `high` | [N] |
| Exploitation | `low` / `medium` / `high` | [N] |
| Chaos | `low` / `medium` / `high` | [N] |

## Signals Detected

### Ghost Job
- [signal_id]: [evidence quote from posting]
- ...

### Exploitation
- [signal_id]: [evidence quote from posting]
- ...

### Chaos
- [signal_id]: [evidence quote from posting]
- ...

## Recommendation

- `proceed` — No significant risks detected; continue to triage.
- `proceed_with_caution` — Medium risk in one or more categories; triage with
  attention to flagged signals.
- `hold` — High risk in one category; investigate before investing time.
- `reject` — High risk in two or more categories, or exploitation risk is
  `high`; do not proceed.

## Quality Badge (for dashboard)

- `quality_clean` — All three categories `low`
- `quality_caution` — At least one `medium`, no `high`
- `quality_flagged` — At least one `high`
- `quality_reject` — Two or more `high`, or exploitation `high`
```

---

## Integration with Triage Mode

The quality audit feeds into `modes/01_JOB_TRIAGE.md` as follows:

1. **Early gate:** If `recommendation` is `reject`, triage should record
   `quality_audit_reject` in the Early Rejection Protocol and skip full
   evaluation.
2. **Penalty adjustment:** If `recommendation` is `proceed_with_caution` or
   `hold`, apply a -0.5 to -1.0 penalty to the `life_sustainability` and
   `growth_upside` dimensions in the triage scoring.
3. **Decision record:** The triage Decision Summary must include:
   - `quality_audit_recommendation`: `proceed` | `proceed_with_caution` | `hold` | `reject`
   - `quality_badge`: `quality_clean` | `quality_caution` | `quality_flagged` | `quality_reject`
4. **Skip option:** The user can skip the quality audit in triage. If skipped,
   record `quality_audit_skipped` in the decision record.

---

## Scoring Config Integration

The `config/scoring.yaml` file may include a `quality_audit` section that
maps risk levels to score penalties:

```yaml
quality_audit:
  ghost_job_penalty:
    low: 0.0
    medium: -0.5
    high: -1.0
  exploitation_penalty:
    low: 0.0
    medium: -0.5
    high: -1.5
  chaos_penalty:
    low: 0.0
    medium: -0.3
    high: -0.8
  multi_high_escalation: -1.0  # additional penalty if 2+ categories are high
```

Users can override these values in their local `config/scoring.yaml`.

---

## Limitations

- **Posting text only:** Without external data (Glassdoor, Blind, Layoffs.fyi),
  chaos signals are weaker. The mode marks these as `inferred_from_text_only`.
- **False positives:** AI semantic analysis can over-flag. The human always
  makes the final call.
- **Posting age:** If the user cannot provide posting age, ghost job risk is
  less reliable. Mark as `posting_age_unknown` in signals.
- **No external scraping:** This mode does not scrape Glassdoor, Blind, or
  any external review site. External data is user-provided only.

---

## Privacy and Ethics

- This mode analyzes publicly available job posting text only.
- No personal data of employees or hiring managers is collected.
- Risk signals are advisory, not accusations. A `high` ghost job risk does
  not mean the company is acting in bad faith — it means the posting exhibits
  patterns consistent with ghost jobs.
- The user should not share audit results publicly in a way that names
  specific companies without independent verification.
