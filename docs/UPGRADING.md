# Upgrade Safely

Use this guide for every Job Search Workflow Community Edition update. It keeps
your personal workspace separate from framework code so you can test a new
release without overwriting career data.

## What a Release Changes

The framework code is versioned in Git. Your personal data lives in local,
Git-ignored directories:

- `user_data/`
- `inbox/`
- `exports/`
- `outputs/`
- `runs/`

Before every upgrade, make a copy of the directories that exist. Do not assume
a clean `git status` means that personal data is absent: Git intentionally does
not show ignored files.

Current Community Edition releases do not run a database migration or write to
these directories. The dashboard is read-only. Still, keep a dated backup so
you can return to the previous workspace without risk.

## Recommended: Test a New Clone First

This is the safest path for most users. Keep the old folder unchanged until the
new dashboard shows the expected records.

1. Close any running dashboard process.
2. Back up the five personal directories listed above from your current clone.
3. Clone the tagged release into a separate folder. Replace `vX.Y.Z` with the
   release tag shown in the release notes.

   ```bash
   git clone --branch vX.Y.Z https://github.com/rcnsnr/job-search-workflow.git job-search-workflow-vX.Y.Z
   cd job-search-workflow-vX.Y.Z
   ./scripts/setup.sh --check-only
   ./scripts/setup.sh
   ```

   On Windows Command Prompt, use `scripts\setup.bat --check-only` and then
   `scripts\setup.bat`.

4. Start the new dashboard against the old workspace. Replace the path with the
   absolute path of your existing clone.

   ```bash
   JSW_WORKSPACE="/absolute/path/to/your-existing-workspace" python3 -m jsw dashboard
   ```

5. Check your jobs, profile and application documents in the browser. If they
   look correct, you can use the new clone. Keep the old clone and backup until
   you are comfortable with the update.

For long-term separation, copy the five personal directories into a dedicated
local folder outside every clone, then point the dashboard at that folder with
`JSW_WORKSPACE`. Future code upgrades can then use fresh clones without moving
your data.

## Update an Unmodified Direct Clone

Use this only when `git status --short` shows no tracked-code changes that you
need to keep. Back up personal directories first.

```bash
git fetch origin --tags
git switch main
git pull --ff-only origin main
git switch --detach vX.Y.Z
./scripts/setup.sh --check-only
./scripts/setup.sh
PYTHONPATH=scripts python3 -m jsw smoke
```

`--ff-only` is deliberate: it stops instead of combining an unexpected local
history with the public release. If it stops, use the recommended new-clone
path rather than forcing a pull, rebase, or reset.

## Update a Fork

Fork owners should keep their fork remote as `origin` and add the public
project as `upstream` once:

```bash
git remote add upstream https://github.com/rcnsnr/job-search-workflow.git
git fetch upstream --tags
git switch main
git merge --ff-only upstream/main
git push origin main
git switch --detach vX.Y.Z
```

If the fast-forward merge stops because your fork has framework changes, do not
force it. Create a separate upgrade branch from `upstream/main`, test it against
your existing workspace, and merge your customizations deliberately.

## Roll Back

Your backup and old clone remain valid rollback points. To return the framework
code to a prior known tag, switch the new clone to that tag. Your ignored
personal directories are not changed by this command.

```bash
git switch --detach vPREVIOUS.VERSION
```

Never use `git reset --hard` as an upgrade step. It is unnecessary for the
supported update paths and can discard tracked local changes.

## Release Notes Rule

Every GitHub release note links to this current guide. Start release text from
the [release-notes template](release-notes-template.md); the release-policy
workflow verifies the public link after a release is published or edited.
