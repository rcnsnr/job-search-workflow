from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


SOURCE_ROOT = Path(__file__).resolve().parents[1]
SETUP_SH = SOURCE_ROOT / "scripts" / "setup.sh"


class SetupScriptTests(unittest.TestCase):
    def make_repo(self) -> Path:
        root = Path(tempfile.mkdtemp(prefix="workflow-public-setup-"))
        self.addCleanup(shutil.rmtree, root, True)
        (root / "scripts").mkdir()
        shutil.copy2(SETUP_SH, root / "scripts" / "setup.sh")
        (root / "README.md").write_text("# Test\n", encoding="utf-8")
        (root / ".gitignore").write_text(".venv/\n", encoding="utf-8")
        mode = (root / "scripts" / "setup.sh").stat().st_mode
        (root / "scripts" / "setup.sh").chmod(mode | stat.S_IXUSR)
        return root

    def run_setup(self, root: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(root / "scripts" / "setup.sh"), *args],
            cwd="/",
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

    def test_help_works_outside_repo_root(self) -> None:
        root = self.make_repo()
        result = self.run_setup(root, "--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--check-only", result.stdout)

    def test_unknown_argument_fails(self) -> None:
        root = self.make_repo()
        result = self.run_setup(root, "--unknown")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unknown argument", result.stderr)

    def test_check_only_does_not_create_runtime_directories(self) -> None:
        root = self.make_repo()
        result = self.run_setup(root, "--check-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PASS setup-check", result.stdout)
        self.assertFalse((root / "user_data").exists())
        self.assertFalse((root / "inbox").exists())

    def test_check_only_fails_when_required_repo_file_is_missing(self) -> None:
        root = self.make_repo()
        (root / "README.md").unlink()
        result = self.run_setup(root, "--check-only")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Required repository file is missing", result.stderr)

    def test_full_setup_creates_directories_and_is_idempotent(self) -> None:
        root = self.make_repo()
        first = self.run_setup(root)
        second = self.run_setup(root)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertIn("PASS setup", first.stdout)
        for relative in ("user_data", "inbox/jobs", "runs", "outputs", "exports"):
            self.assertTrue((root / relative).is_dir(), relative)

    def test_fixture_copy_preserves_existing_user_file(self) -> None:
        root = self.make_repo()
        (root / "fixtures").mkdir()
        (root / "fixtures" / "sample-career_profile.md").write_text("# Sample\n", encoding="utf-8")
        (root / "fixtures" / "sample-target_roles.md").write_text("# Roles\n", encoding="utf-8")
        (root / "user_data").mkdir()
        profile = root / "user_data" / "career_profile.md"
        profile.write_text("# Existing\n", encoding="utf-8")
        result = self.run_setup(root)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(profile.read_text(encoding="utf-8"), "# Existing\n")
        self.assertEqual((root / "user_data" / "target_roles.md").read_text(encoding="utf-8"), "# Roles\n")

    def test_invalid_python_file_fails_setup(self) -> None:
        root = self.make_repo()
        (root / "scripts" / "broken.py").write_text("def broken(:\n", encoding="utf-8")
        result = self.run_setup(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Python compilation failed", result.stderr)

    def test_failing_npm_test_fails_setup(self) -> None:
        root = self.make_repo()
        (root / "package.json").write_text(
            '{"private":true,"scripts":{"test":"node -e \\"process.exit(7)\\""}}\n',
            encoding="utf-8",
        )
        result = self.run_setup(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("PASS setup", result.stdout)


if __name__ == "__main__":
    unittest.main()
