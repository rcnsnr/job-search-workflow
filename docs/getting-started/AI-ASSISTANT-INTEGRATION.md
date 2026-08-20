# AI Assistant Integration Guide

Job Search Workflow Community Edition works with assistants that can accept
pasted text. It does not require an account, an API key, or a connection to an
AI provider.

## The Safe Default

Use the same portable flow with ChatGPT, Claude, Codex, Cursor, Windsurf, or
another assistant:

1. Open the mode file for the task, such as
   [`modes/01_JOB_TRIAGE.md`](../../modes/01_JOB_TRIAGE.md).
2. Copy the complete mode file into the assistant.
3. Add only the profile excerpt needed for this task.
4. Paste the job posting or another task input.
5. Review the output before saving it into your local workspace.

This method works even when the assistant has no access to your repository.

## Choose What to Share

Start with the smallest useful amount of information.

| Sharing level | Use it when | Include | Keep out by default |
| --- | --- | --- | --- |
| Fixture-only practice | You are learning the workflow | Files under `fixtures/` | All personal information |
| Narrow profile excerpt | You are evaluating one role | Relevant skills, constraints, and selected achievements | Contact details, full history, unrelated applications |
| Full local document | You have reviewed the provider policy and need broader tailoring | Only the files needed for that task | Repository history, credentials, and unrelated records |

The framework does not send your files to an AI provider. Pasting or uploading
content to an AI assistant sends that selected content to the provider. Review
the provider's current privacy, retention, and workspace-access settings before
sharing personal material.

## Browser Chat and Workspace-Aware Assistants

### Browser Chat

For a browser chat, copy and paste the mode, a narrow profile excerpt, and the
job posting. Do not assume that a browser-based AI chat can read a local file path. A file path is only a reference on your machine, not a transfer of the file's contents.

### Workspace-Aware Assistant

Tools such as Codex, Cursor, or Windsurf can sometimes read files from a local
workspace after you grant access. Before doing that:

1. Confirm which folder the tool can access.
2. Ask it to read only named files, for example `user_data/target_roles.md`.
3. Avoid broad instructions such as "read everything".
4. Check the tool and provider settings for cloud processing and retention.

Workspace access can reduce copy and paste, but it does not remove the need to
understand where the tool processes your content.

## First Triage Prompt Shape

Use this order after pasting the full job-triage mode:

```text
Use the mode above as the evaluation contract.

Candidate context for this role:
[paste a narrow, verified profile excerpt]

Job posting:
[paste the posting]

Return the structured triage result. Mark unsupported facts as Unknown.
Do not submit an application or modify files.
```

For a fixture-only rehearsal, replace the candidate context and job posting
with [`fixtures/sample-profile.md`](../../fixtures/sample-profile.md) and
[`fixtures/sample-job-posting.md`](../../fixtures/sample-job-posting.md).

## What the Framework Does Not Do

- It does not send your profile, job history, or application records to an AI
  provider.
- It does not submit applications, contact recruiters, or change your files
  automatically.
- It does not make a decision for you. Read-only workflow guards can report
  evidence, but you make the final decision.

Continue with the [30-Minute Quickstart](QUICKSTART-30MIN.md) for one complete
first triage, or use [Getting Started](GETTING_STARTED.md) for the detailed
workflow.
