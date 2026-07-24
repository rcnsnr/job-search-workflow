# Job Quality Audit — Sample Run

## Posting

- **Company:** Acme Platform Inc (fictitious)
- **Role:** Senior Platform Engineer
- **Location:** "Remote (US / EU / APAC / LatAm / Africa — choose your hub)"
- **Posting age:** 120 days (user-reported)
- **Source:** LinkedIn

## Risk Summary

| Category | Risk Level | Signal Count |
|----------|-----------|--------------|
| Ghost job | `high` | 5 |
| Exploitation | `medium` | 3 |
| Chaos | `low` | 1 |

## Signals Detected

### Ghost Job

- `posting_age_90_plus`: Posting has been open 120 days as reported by the
  user. No closure or update visible.
- `repeated_repost`: The same role was reposted 3 times in the last 6 months
  under slightly different titles ("Senior Platform Engineer", "Staff Platform
  Engineer", "Platform Engineer — Remote").
- `evergreen_language`: Description contains "We are always looking for
  talented platform engineers to join our growing team."
- `unicorn_skill_list`: Requirements span Kubernetes, Terraform, Python, Go,
  Rust, React, PostgreSQL DBA, SOC2 compliance, and sales engineering support.
- `vague_compensation`: No salary range, no equity percentage, no compensation
  philosophy link despite being a US-based remote role (high-transparency
  market).

### Exploitation

- `rockstar_ninja_language`: Title section says "We are looking for a platform
  rockstar who eats Kubernetes for breakfast."
- `heavy_oncall`: "You will own the pager 24/7 and be the first responder for
  all production incidents." No on-call compensation or rotation described.
- `undefined_hours`: "Flexible working hours" with no core hours specified.
  "We expect our engineers to be available across time zones when needed."

### Chaos

- `rapid_repost`: Role reposted within 45 days of the previous posting closing,
  suggesting the previous hire left quickly or was not retained.

## Recommendation

`hold` — High ghost job risk (5 signals) with medium exploitation risk (3
signals). Chaos risk is low but the rapid repost is a turnover signal. Do not
invest time in CV tailoring until the user independently verifies the role is
actively being filled.

Suggested verification steps:

1. Check if the hiring manager is active on LinkedIn (recent posts, profile
   updates).
2. Search for recent departures from the same team on LinkedIn.
3. Ask the recruiter (if contacted) for posting age, team size, and reason for
   the repost.

## Quality Badge

`quality_flagged` — At least one category is `high` (ghost job).

## Score Impact (per config/scoring.yaml)

- Ghost job penalty: -1.0 (high)
- Exploitation penalty: -0.5 (medium)
- Chaos penalty: 0.0 (low)
- Multi-high escalation: 0.0 (only one category is high)
- **Total quality audit penalty: -1.5**

## Notes

- This is a fictitious example for demonstration purposes only.
- All company names, role details, and signal evidence are fabricated.
- In a real audit, the evidence quotes should be verbatim from the posting.
- The user always makes the final decision. A `hold` recommendation means
  "investigate before proceeding," not "do not apply."
