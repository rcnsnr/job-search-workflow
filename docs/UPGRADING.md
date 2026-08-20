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

## Recommended: Run the Upgrade Script

This is the supported path for direct clones and forks. Close any running
dashboard process, open a terminal in your current clone, and run the exact tag
named in the release notes:

```bash
./scripts/upgrade.sh vX.Y.Z
```

On Windows Command Prompt:

```bat
scripts\upgrade.bat vX.Y.Z
```

The script does four things in this order:

1. Creates a dated backup outside the current clone.
2. Clones the requested release into a separate sibling folder.
3. Copies `user_data/`, `inbox/`, `exports/`, `outputs/` and `runs/` into that
   new folder.
4. Checks the new release prerequisites without changing the original
   workspace.

It never runs `git pull`, `git reset`, `git rebase`, or a delete command against
your existing workspace. If the tag, backup path, copy, clone, or prerequisite
check fails, it stops and leaves the original workspace in place.

You may omit the version to use the latest published stable GitHub release, but
using the exact tag from release notes is more reproducible:

```bash
./scripts/upgrade.sh
```

After a successful run, open the printed new workspace path, install the local
dashboard dependency if needed, and start the dashboard there. Keep the old
clone and dated backup until you have checked your records.

### One-Time Bootstrap for v0.2.0 and Earlier

Older releases do not include the upgrade scripts. Download or clone the
`v0.2.1` source into a temporary folder, then point its script at your current
workspace. This first bootstrap does not alter the old workspace:

```bash
git clone --branch v0.2.1 https://github.com/rcnsnr/job-search-workflow.git /tmp/jsw-upgrade-v0.2.1
/tmp/jsw-upgrade-v0.2.1/scripts/upgrade.sh v0.2.1 --source /absolute/path/to/your-current-workspace
```

On Windows, clone `v0.2.1` into a temporary folder and run
`scripts\upgrade.bat v0.2.1 --source C:\path\to\your-current-workspace` from
that temporary clone. From `v0.2.1` onward, the normal one-command path is
available inside every workspace.

## Forks and Local Customizations

The upgrade scripts always clone the official tagged Community Edition release
into a new sibling folder. They do not merge, rebase, or alter your fork's Git
history, so the same command is safe when your fork or clone has local framework
customizations. Compare and transfer any custom code deliberately after the new
workspace has been checked.

## Roll Back

Your backup and old clone remain valid rollback points. To return the framework
code to a prior known tag, switch the new clone to that tag. Your ignored
personal directories are not changed by this command.

```bash
git switch --detach vPREVIOUS.VERSION
```

Never use `git reset --hard` as an upgrade step. It is unnecessary for the
supported update script and can discard tracked local changes.

## Release Notes Rule

Every GitHub release note links to this current guide. Start release text from
the [release-notes template](release-notes-template.md); the release-policy
workflow verifies the public link after a release is published or edited.
