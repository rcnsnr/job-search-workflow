#!/usr/bin/env python3
"""Read-only validation helpers for a local Community Edition workspace."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import yaml


FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
EXIT_CODES = {"PASS": 0, "FAIL": 1, "BLOCKED": 2, "REVIEW": 3}
TRACKING_QUERY_KEYS = {"campaign", "ref", "source", "tracking", "trk"}


@dataclass(frozen=True)
class CheckResult:
    check: str
    status: str
    summary: str
    details: list[dict[str, Any]] = field(default_factory=list)


def load_yaml(path: str | Path) -> dict[str, Any]:
    value = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a YAML mapping: {path}")
    return value


def parse_frontmatter(path: str | Path) -> dict[str, Any]:
    text = Path(path).read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    value = yaml.safe_load(match.group(1))
    return value if isinstance(value, dict) else {}


def normalize_text(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def normalize_url(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    parsed = urlsplit(text)
    normalized_path = parsed.path.rstrip("/") or "/"
    identity_query = sorted(
        (key, item)
        for key, item in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.casefold().startswith("utm_") and key.casefold() not in TRACKING_QUERY_KEYS
    )
    return urlunsplit(
        (
            parsed.scheme.casefold(),
            parsed.netloc.casefold(),
            normalized_path,
            urlencode(identity_query),
            "",
        )
    )


def iter_job_records(jobs_dir: str | Path):
    directory = Path(jobs_dir)
    if not directory.exists():
        return
    for path in sorted(directory.glob("*.md")):
        metadata = parse_frontmatter(path)
        if metadata:
            yield path, metadata


def check_duplicate(
    jobs_dir: str | Path,
    *,
    company: str,
    role_title: str,
    location: str,
    work_model: str,
    source_url: str,
) -> CheckResult:
    required = {"company": company, "role_title": role_title, "source_url": source_url}
    missing = [name for name, value in required.items() if not str(value).strip()]
    if missing:
        return CheckResult(
            "duplicate",
            "BLOCKED",
            "Candidate identity is incomplete.",
            [{"reason": "missing_identity", "fields": missing}],
        )

    candidate_url = normalize_url(source_url)
    candidate_identity = tuple(normalize_text(value) for value in (company, role_title, location, work_model))
    details: list[dict[str, Any]] = []

    for path, metadata in iter_job_records(jobs_dir):
        existing_url = normalize_url(metadata.get("source_url"))
        if candidate_url and existing_url == candidate_url:
            details.append({"path": path.name, "reason": "source_url"})
            continue

        existing_identity = tuple(
            normalize_text(metadata.get(name))
            for name in ("company", "role_title", "location", "work_model")
        )
        if all(candidate_identity) and existing_identity == candidate_identity:
            details.append({"path": path.name, "reason": "identity"})

    if details:
        return CheckResult("duplicate", "FAIL", "A matching job record already exists.", details)
    return CheckResult("duplicate", "PASS", "No duplicate job record was found.")


def parse_answer_sections(path: str | Path) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current_heading: str | None = None
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        match = HEADING_RE.match(line)
        if match:
            current_heading = normalize_text(match.group(1))
            sections[current_heading] = []
        elif current_heading is not None:
            sections[current_heading].append(line)

    return {
        heading: "\n".join(lines).strip()
        for heading, lines in sections.items()
    }


def check_form_limits(schema_path: str | Path, answers_path: str | Path) -> CheckResult:
    schema = load_yaml(schema_path)
    fields = schema.get("fields", [])
    if not isinstance(fields, list):
        return CheckResult(
            "form_limits",
            "BLOCKED",
            "Form schema fields must be a list.",
            [{"reason": "invalid_schema"}],
        )

    answers = parse_answer_sections(answers_path)
    details: list[dict[str, Any]] = []

    for item in fields:
        if not isinstance(item, dict):
            details.append({"reason": "invalid_field_schema"})
            continue
        field_id = str(item.get("id") or "").strip()
        heading = str(item.get("heading") or "").strip()
        answer = answers.get(normalize_text(heading), "")
        required = bool(item.get("required", False))
        max_length = item.get("max_length")

        if required and not answer:
            details.append({"field": field_id, "heading": heading, "reason": "missing_required"})
            continue
        if max_length is not None:
            try:
                limit = int(max_length)
            except (TypeError, ValueError):
                details.append({"field": field_id, "reason": "invalid_max_length"})
                continue
            if len(answer) > limit:
                details.append(
                    {
                        "field": field_id,
                        "heading": heading,
                        "reason": "over_limit",
                        "length": len(answer),
                        "max_length": limit,
                    }
                )

    if details:
        return CheckResult("form_limits", "FAIL", "Application answers need correction.", details)
    return CheckResult("form_limits", "PASS", "Application answers satisfy the configured limits.")


def check_lifecycle(policy_path: str | Path, jobs_dir: str | Path) -> CheckResult:
    policy = load_yaml(policy_path)
    states = {normalize_text(value) for value in policy.get("states", [])}
    required_fields = policy.get("required_fields", {})
    if not states or not isinstance(required_fields, dict):
        return CheckResult(
            "lifecycle",
            "BLOCKED",
            "Lifecycle policy is incomplete.",
            [{"reason": "invalid_policy"}],
        )

    details: list[dict[str, Any]] = []
    for path, metadata in iter_job_records(jobs_dir):
        state = normalize_text(metadata.get("triage_state"))
        if state not in states:
            details.append(
                {
                    "path": path.name,
                    "reason": "unknown_state" if state else "missing_state",
                    "state": state or None,
                }
            )
            continue

        required_for_state = required_fields.get(state, [])
        if not isinstance(required_for_state, list):
            details.append({"path": path.name, "reason": "invalid_policy_state", "state": state})
            continue
        for field_name in required_for_state:
            if not metadata.get(str(field_name)):
                details.append(
                    {
                        "path": path.name,
                        "reason": "missing_required_field",
                        "state": state,
                        "field": str(field_name),
                    }
                )

    if details:
        return CheckResult("lifecycle", "FAIL", "Workflow lifecycle metadata is inconsistent.", details)
    return CheckResult("lifecycle", "PASS", "Workflow lifecycle metadata is consistent.")


def as_tristate(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    normalized = normalize_text(value)
    if normalized in {"yes", "true", "provided", "required"}:
        return True
    if normalized in {"no", "false", "not provided", "not required"}:
        return False
    return None


def evaluate_eligibility(policy_path: str | Path, job: dict[str, Any]) -> CheckResult:
    policy = load_yaml(policy_path)
    eligible_regions = {normalize_text(value) for value in policy.get("eligible_regions", [])}
    allow_sponsorship = bool(policy.get("allow_outside_regions_with_sponsorship", False))
    relocation_allowed = bool(policy.get("relocation_allowed", False))

    hiring_region = normalize_text(job.get("hiring_region"))
    relocation_required = as_tristate(job.get("relocation_required"))
    sponsorship_required = as_tristate(job.get("sponsorship_required"))
    sponsorship_provided = as_tristate(job.get("sponsorship_provided"))

    if relocation_required is True and not relocation_allowed:
        return CheckResult(
            "eligibility",
            "FAIL",
            "The role requires relocation that the policy does not allow.",
            [{"reason": "relocation_not_allowed"}],
        )

    if not hiring_region:
        return CheckResult(
            "eligibility",
            "REVIEW",
            "Hiring region is not known.",
            [{"reason": "missing_hiring_region"}],
        )

    if hiring_region in eligible_regions:
        if sponsorship_required is True and sponsorship_provided is False:
            return CheckResult(
                "eligibility",
                "FAIL",
                "Required sponsorship is not provided.",
                [{"reason": "sponsorship_unavailable"}],
            )
        if sponsorship_required is True and sponsorship_provided is None:
            return CheckResult(
                "eligibility",
                "REVIEW",
                "Sponsorship availability needs confirmation.",
                [{"reason": "sponsorship_unknown"}],
            )
        return CheckResult("eligibility", "PASS", "The role matches the configured eligibility policy.")

    if not allow_sponsorship:
        return CheckResult(
            "eligibility",
            "FAIL",
            "The hiring region is outside the configured eligible regions.",
            [{"reason": "region_not_eligible", "hiring_region": hiring_region}],
        )
    if sponsorship_provided is True:
        return CheckResult(
            "eligibility",
            "PASS",
            "The role is outside the configured regions but sponsorship is provided.",
        )
    if sponsorship_provided is False:
        return CheckResult(
            "eligibility",
            "FAIL",
            "The role is outside the configured regions and sponsorship is unavailable.",
            [{"reason": "sponsorship_unavailable", "hiring_region": hiring_region}],
        )
    return CheckResult(
        "eligibility",
        "REVIEW",
        "The role needs sponsorship confirmation.",
        [{"reason": "sponsorship_unknown", "hiring_region": hiring_region}],
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    duplicate = subparsers.add_parser("duplicate", help="Check a candidate job against local records.")
    duplicate.add_argument("--jobs-dir", type=Path, required=True)
    duplicate.add_argument("--company", required=True)
    duplicate.add_argument("--role-title", required=True)
    duplicate.add_argument("--location", default="")
    duplicate.add_argument("--work-model", default="")
    duplicate.add_argument("--source-url", required=True)

    form_limits = subparsers.add_parser("form-limits", help="Validate Markdown answers against field limits.")
    form_limits.add_argument("--schema", type=Path, required=True)
    form_limits.add_argument("--answers", type=Path, required=True)

    lifecycle = subparsers.add_parser("lifecycle", help="Validate job lifecycle metadata.")
    lifecycle.add_argument("--policy", type=Path, required=True)
    lifecycle.add_argument("--jobs-dir", type=Path, required=True)

    eligibility = subparsers.add_parser("eligibility", help="Evaluate a job against a user policy.")
    eligibility.add_argument("--policy", type=Path, required=True)
    eligibility.add_argument("--job", type=Path, required=True)

    return parser


def run_command(args: argparse.Namespace) -> CheckResult:
    if args.command == "duplicate":
        return check_duplicate(
            args.jobs_dir,
            company=args.company,
            role_title=args.role_title,
            location=args.location,
            work_model=args.work_model,
            source_url=args.source_url,
        )
    if args.command == "form-limits":
        return check_form_limits(args.schema, args.answers)
    if args.command == "lifecycle":
        return check_lifecycle(args.policy, args.jobs_dir)
    if args.command == "eligibility":
        return evaluate_eligibility(args.policy, parse_frontmatter(args.job))
    raise ValueError(f"Unsupported command: {args.command}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = run_command(args)
    except (OSError, ValueError, yaml.YAMLError) as error:
        result = CheckResult(
            args.command,
            "BLOCKED",
            "The check could not run.",
            [{"reason": "input_error", "message": str(error)}],
        )

    print(json.dumps(asdict(result), indent=2, sort_keys=True))
    return EXIT_CODES[result.status]


if __name__ == "__main__":
    sys.exit(main())
