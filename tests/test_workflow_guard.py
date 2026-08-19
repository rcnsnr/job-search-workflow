from __future__ import annotations

import sys
from importlib import util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GUARD_PATH = ROOT / "scripts" / "workflow_guard.py"
SPEC = util.spec_from_file_location("workflow_guard", GUARD_PATH)
assert SPEC and SPEC.loader
workflow_guard = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = workflow_guard
SPEC.loader.exec_module(workflow_guard)


def write_job(path: Path, **fields: object) -> None:
    frontmatter = "\n".join(f"{key}: {value}" for key, value in fields.items())
    path.write_text(f"---\n{frontmatter}\n---\n\n## Notes\n\nFixture.\n", encoding="utf-8")


def test_duplicate_check_matches_normalized_source_url(tmp_path: Path) -> None:
    write_job(
        tmp_path / "existing.md",
        source_id="fixture-1",
        source_url="https://example.com/jobs/42?ref=feed",
        company="Example Labs",
        role_title="Platform Engineer",
        location="Remote",
        work_model="remote",
        triage_state="captured",
    )

    result = workflow_guard.check_duplicate(
        tmp_path,
        company="Another Company",
        role_title="Another Role",
        location="Elsewhere",
        work_model="hybrid",
        source_url="https://example.com/jobs/42",
    )

    assert result.status == "FAIL"
    assert result.details[0]["reason"] == "source_url"


def test_duplicate_check_passes_for_distinct_identity(tmp_path: Path) -> None:
    write_job(
        tmp_path / "existing.md",
        source_id="fixture-1",
        source_url="https://example.com/jobs/42",
        company="Example Labs",
        role_title="Platform Engineer",
        location="Remote",
        work_model="remote",
        triage_state="captured",
    )

    result = workflow_guard.check_duplicate(
        tmp_path,
        company="Northwind",
        role_title="Site Reliability Engineer",
        location="Berlin",
        work_model="hybrid",
        source_url="https://example.org/jobs/9",
    )

    assert result.status == "PASS"


def test_duplicate_check_preserves_identity_query_parameters(tmp_path: Path) -> None:
    write_job(
        tmp_path / "existing.md",
        source_id="fixture-1",
        source_url="https://example.com/jobs?jobId=42&utm_source=feed",
        company="Example Labs",
        role_title="Platform Engineer",
        location="Remote",
        work_model="remote",
        triage_state="captured",
    )

    result = workflow_guard.check_duplicate(
        tmp_path,
        company="Example Labs",
        role_title="Infrastructure Engineer",
        location="Remote",
        work_model="remote",
        source_url="https://example.com/jobs?jobId=43&utm_source=feed",
    )

    assert result.status == "PASS"


def test_form_limits_report_overflow_and_missing_required_answer(tmp_path: Path) -> None:
    schema = tmp_path / "form.yaml"
    answers = tmp_path / "answers.md"
    schema.write_text(
        "fields:\n"
        "  - id: motivation\n"
        "    heading: Why this role?\n"
        "    required: true\n"
        "    max_length: 10\n"
        "  - id: portfolio\n"
        "    heading: Portfolio URL\n"
        "    required: true\n"
        "    max_length: 100\n",
        encoding="utf-8",
    )
    answers.write_text("## Why this role?\n\nThis answer is too long.\n", encoding="utf-8")

    result = workflow_guard.check_form_limits(schema, answers)

    assert result.status == "FAIL"
    assert {detail["reason"] for detail in result.details} == {"over_limit", "missing_required"}


def test_form_limits_pass_when_answers_fit(tmp_path: Path) -> None:
    schema = tmp_path / "form.yaml"
    answers = tmp_path / "answers.md"
    schema.write_text(
        "fields:\n  - id: motivation\n    heading: Why this role?\n    required: true\n    max_length: 20\n",
        encoding="utf-8",
    )
    answers.write_text("## Why this role?\n\nGood fit.\n", encoding="utf-8")

    assert workflow_guard.check_form_limits(schema, answers).status == "PASS"


def test_lifecycle_check_rejects_unknown_or_incomplete_state(tmp_path: Path) -> None:
    policy = tmp_path / "lifecycle.yaml"
    jobs = tmp_path / "jobs"
    jobs.mkdir()
    policy.write_text(
        "states: [captured, applied, closed]\n"
        "required_fields:\n"
        "  applied: [applied_date]\n",
        encoding="utf-8",
    )
    write_job(
        jobs / "missing-date.md",
        source_id="fixture-2",
        source_url="https://example.com/jobs/2",
        company="Example Labs",
        role_title="Engineer",
        triage_state="applied",
    )
    write_job(
        jobs / "unknown.md",
        source_id="fixture-3",
        source_url="https://example.com/jobs/3",
        company="Example Labs",
        role_title="Engineer",
        triage_state="invented",
    )

    result = workflow_guard.check_lifecycle(policy, jobs)

    assert result.status == "FAIL"
    assert {detail["reason"] for detail in result.details} == {"missing_required_field", "unknown_state"}


def test_eligibility_is_policy_driven_and_can_pass_fail_or_review(tmp_path: Path) -> None:
    policy = tmp_path / "eligibility.yaml"
    policy.write_text(
        "eligible_regions: [home, global]\n"
        "allow_outside_regions_with_sponsorship: true\n"
        "relocation_allowed: false\n",
        encoding="utf-8",
    )

    assert workflow_guard.evaluate_eligibility(
        policy,
        {"hiring_region": "home", "relocation_required": False},
    ).status == "PASS"
    assert workflow_guard.evaluate_eligibility(
        policy,
        {"hiring_region": "outside", "sponsorship_provided": False},
    ).status == "FAIL"
    assert workflow_guard.evaluate_eligibility(
        policy,
        {"hiring_region": "outside", "sponsorship_provided": "unknown"},
    ).status == "REVIEW"
