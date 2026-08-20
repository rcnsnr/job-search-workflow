# 30-Minute Quickstart

This guide gets you from a ready local workspace to one documented job triage.
The 30-minute path starts after base setup is complete. Installation time and
optional LaTeX or DOCX tools are outside this estimate.

## Before You Start

1. Clone the repository and run the setup path in the [README](../../README.md).
2. Confirm that `user_data/` and `inbox/jobs/` exist.
3. Choose an AI sharing path in the
   [AI Assistant Integration Guide](AI-ASSISTANT-INTEGRATION.md).

If you only want to learn the workflow, use the fictitious files in `fixtures/`
and do not add personal information yet.

## 0-5 Minutes: Set Your Direction

Open these local files in an editor:

- `user_data/career_profile.md`
- `user_data/target_roles.md`

Replace only the most important placeholders: target roles, core skills, work
preferences, and deal-breakers. For this first run, prepare a short excerpt
that relates to the role you will evaluate. Keep contact details and unrelated
history out of the assistant by default.

## 5-10 Minutes: Pick One Posting

Choose one public job posting, or rehearse with
[`fixtures/sample-job-posting.md`](../../fixtures/sample-job-posting.md). Keep
the source URL with the posting so you can revisit the evidence later.

## 10-22 Minutes: Run the Triage

1. Open [`modes/01_JOB_TRIAGE.md`](../../modes/01_JOB_TRIAGE.md).
2. Paste the entire mode into your AI assistant.
3. Add your narrow profile excerpt.
4. Paste the job posting.
5. Ask for the structured result required by the mode.

Use the prompt shape in the [AI Assistant Integration Guide](AI-ASSISTANT-INTEGRATION.md)
if you want a copy-ready starting point. The assistant should mark missing
evidence as `Unknown`; do not fill gaps with guesses.

## 22-30 Minutes: Save the Result Locally

Create a Markdown record under `inbox/jobs/` with a clear date, company, and
role title in its filename. Use the structure in
[`fixtures/sample-triage-run.md`](../../fixtures/sample-triage-run.md) as a
reference, then keep the original posting URL and the evaluation result in the
record.

Before moving a role forward, run the read-only checks in
[Workflow Guards](WORKFLOW_GUARDS.md). They can identify duplicate records,
missing lifecycle fields, and eligibility questions, but they never submit an
application or change a record for you.

## You Are Ready for the Next Step

At this point you have one documented triage and a repeatable process. Continue
with [Getting Started](GETTING_STARTED.md) to tailor a CV, export documents, or
use the local dashboard.

## If Something Is Missing

- Setup issue: read [Setup and Verification](../setup-and-verification.md).
- Unsure what to share with an AI assistant: return to the
  [AI Assistant Integration Guide](AI-ASSISTANT-INTEGRATION.md).
- Need a safe practice run: use the files in `fixtures/` first.
