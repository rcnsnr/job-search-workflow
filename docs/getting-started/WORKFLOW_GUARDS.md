# Workflow Guards

Job Search Workflow Community Edition includes read-only guards for common
local workflow mistakes. The guards report evidence; they do not capture jobs,
move files, change lifecycle state, or submit applications.

## Result Contract

Every command prints JSON with:

- `check`: the guard that ran
- `status`: `PASS`, `FAIL`, `REVIEW`, or `BLOCKED`
- `summary`: a short explanation
- `details`: exact fields or records that need attention

Exit codes are:

| Exit | Status | Meaning |
| --- | --- | --- |
| `0` | `PASS` | The configured check passed. |
| `1` | `FAIL` | Evidence conflicts with the configured rule. |
| `2` | `BLOCKED` | Input or configuration is incomplete or invalid. |
| `3` | `REVIEW` | A human needs to resolve an unknown value. |

## Duplicate Check

Check a candidate before adding a new Markdown record:

```bash
python3 scripts/workflow_guard.py duplicate \
  --jobs-dir inbox/jobs \
  --company "Example Labs" \
  --role-title "Platform Engineer" \
  --location "Remote" \
  --work-model "remote" \
  --source-url "https://example.com/jobs/42"
```

The guard compares a normalized source URL and, when complete, the combined
company, role, location, and work-model identity. Tracking-only query
parameters are removed, while identity-bearing parameters such as a job ID are
retained.

## Form Field Limits

Define application fields in YAML. See
`fixtures/sample-form-fields.yaml`. Each field uses a stable ID, the exact
level-two Markdown heading, a required flag, and an optional character limit.

```bash
python3 scripts/workflow_guard.py form-limits \
  --schema fixtures/sample-form-fields.yaml \
  --answers fixtures/sample-application-answers.md
```

The command reports missing required answers and answers that exceed the
configured character limit.

## Lifecycle Metadata

The default lifecycle contract is `config/lifecycle.yaml`. Users may copy and
change it for their own local workflow.

```bash
python3 scripts/workflow_guard.py lifecycle \
  --policy config/lifecycle.yaml \
  --jobs-dir inbox/jobs
```

The guard verifies that each recognized Markdown record has a known
`triage_state` and the fields required by that state. It never moves active or
closed records.

## Eligibility Policy

Copy `config/eligibility.example.yaml` to a Git-ignored user location and
replace the sample regions with your own work-authorization and relocation
policy.

A job record may provide:

```yaml
hiring_region: europe
sponsorship_required: false
sponsorship_provided: false
relocation_required: false
```

Run:

```bash
python3 scripts/workflow_guard.py eligibility \
  --policy user_data/eligibility.yaml \
  --job inbox/jobs/example-role.md
```

Eligibility is deliberately configurable. The repository does not assume a
home country, citizenship, visa status, or willingness to relocate. Unknown
hiring or sponsorship evidence returns `REVIEW`, not an invented decision.

## Privacy Boundary

Policies under `user_data/` and records under `inbox/` are Git-ignored.
Do not commit personal eligibility settings, real application answers, or job
history to the public repository.
