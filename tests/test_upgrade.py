from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path


SOURCE_ROOT = Path(__file__).resolve().parents[1]
UPGRADE_SH = SOURCE_ROOT / "scripts" / "upgrade.sh"
UPGRADE_BAT = SOURCE_ROOT / "scripts" / "upgrade.bat"


def make_upgrade_fixture() -> tuple[Path, Path, Path]:
    root = Path(tempfile.mkdtemp(prefix="workflow-upgrade-"))
    source = root / "current-workspace"
    template = root / "release-template"
    fake_bin = root / "fake-bin"

    (source / "scripts").mkdir(parents=True)
    (source / ".git").mkdir()
    (source / "README.md").write_text("# Current workspace\n", encoding="utf-8")
    (source / "user_data").mkdir()
    (source / "user_data" / "profile.md").write_text("private profile\n", encoding="utf-8")
    (source / "inbox" / "jobs").mkdir(parents=True)
    (source / "inbox" / "jobs" / "role.md").write_text(encoding="utf-8", data="private job\n")
    shutil.copy2(UPGRADE_SH, source / "scripts" / "upgrade.sh")
    (source / "scripts" / "upgrade.sh").chmod(
        (source / "scripts" / "upgrade.sh").stat().st_mode | stat.S_IXUSR
    )

    (template / "scripts").mkdir(parents=True)
    (template / "README.md").write_text("# Release workspace\n", encoding="utf-8")
    setup = template / "scripts" / "setup.sh"
    setup.write_text("#!/usr/bin/env bash\necho PASS setup-check\n", encoding="utf-8")
    setup.chmod(setup.stat().st_mode | stat.S_IXUSR)

    fake_bin.mkdir()
    fake_git = fake_bin / "git"
    fake_git.write_text(
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        "if [[ $1 == clone ]]; then\n"
        "  target=${@: -1}\n"
        "  mkdir -p \"$target\"\n"
        "  cp -a \"$FAKE_RELEASE_TEMPLATE/.\" \"$target/\"\n"
        "  exit 0\n"
        "fi\n"
        "echo \"unexpected git invocation: $*\" >&2\n"
        "exit 2\n",
        encoding="utf-8",
    )
    fake_git.chmod(fake_git.stat().st_mode | stat.S_IXUSR)
    return root, source, template


def run_upgrade(source: Path, template: Path, *args: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["PATH"] = f"{source.parent / 'fake-bin'}:{environment['PATH']}"
    environment["FAKE_RELEASE_TEMPLATE"] = str(template)
    return subprocess.run(
        [str(source / "scripts" / "upgrade.sh"), *args],
        cwd="/",
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )


def test_upgrade_script_preserves_source_and_copies_personal_data() -> None:
    root, source, template = make_upgrade_fixture()
    try:
        result = run_upgrade(source, template, "v0.2.1")

        assert result.returncode == 0, result.stderr
        assert "PASS upgrade" in result.stdout
        assert (source / "user_data" / "profile.md").read_text(encoding="utf-8") == "private profile\n"
        release = root / "job-search-workflow-v0.2.1"
        assert (release / "user_data" / "profile.md").read_text(encoding="utf-8") == "private profile\n"
        assert (release / "inbox" / "jobs" / "role.md").read_text(encoding="utf-8") == "private job\n"
        backups = list((root / "job-search-workflow-backups").glob("*-v0.2.1"))
        assert len(backups) == 1
        assert (backups[0] / "user_data" / "profile.md").exists()
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_upgrade_script_refuses_to_overwrite_an_existing_release_workspace() -> None:
    root, source, template = make_upgrade_fixture()
    try:
        (root / "job-search-workflow-v0.2.1").mkdir()

        result = run_upgrade(source, template, "v0.2.1")

        assert result.returncode != 0
        assert "Release path already exists" in result.stderr
        assert (source / "user_data" / "profile.md").read_text(encoding="utf-8") == "private profile\n"
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_upgrade_script_accepts_a_source_override_for_bootstrapping() -> None:
    root, source, template = make_upgrade_fixture()
    try:
        bootstrap = root / "bootstrap" / "scripts"
        bootstrap.mkdir(parents=True)
        shutil.copy2(UPGRADE_SH, bootstrap / "upgrade.sh")
        (bootstrap / "upgrade.sh").chmod((bootstrap / "upgrade.sh").stat().st_mode | stat.S_IXUSR)

        result = subprocess.run(
            [str(bootstrap / "upgrade.sh"), "v0.2.1", "--source", str(source)],
            cwd="/",
            env={
                **os.environ,
                "PATH": f"{root / 'fake-bin'}:{os.environ['PATH']}",
                "FAKE_RELEASE_TEMPLATE": str(template),
            },
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        assert result.returncode == 0, result.stderr
        assert (root / "job-search-workflow-v0.2.1" / "user_data" / "profile.md").exists()
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_upgrade_scripts_exist_for_linux_macos_and_windows() -> None:
    assert UPGRADE_SH.is_file()
    assert UPGRADE_BAT.is_file()
    assert "xcopy" in UPGRADE_BAT.read_text(encoding="utf-8").lower()
