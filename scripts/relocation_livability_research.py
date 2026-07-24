#!/usr/bin/env python3
"""Research relocation livability for a target city.

Gathers data on cost of living, healthcare, childcare, crime, racism, and
general livability for a family with 1 working parent + 1 stay-at-home mom +
2 children ≤3 years old.

Uses web search to find current data, then produces a structured markdown
report with 1-5 scores per dimension and a weighted Livability Score.

Usage:
    python3 scripts/relocation_livability_research.py --city Cambridge --country UK
    python3 scripts/relocation_livability_research.py --city London --country UK --salary 85000
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.parse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "docs/sources/relocation-livability"

# Family profile constants
FAMILY_PROFILE = "1 working parent + 1 stay-at-home parent + 2 children age ≤3"

# Weights matching modes/01_JOB_TRIAGE.md
DIMENSIONS = {
    "cost_of_living": {
        "weight": 0.25,
        "label": "Cost of Living (tek gelir, 4 kişi)",
        "search_queries": [
            "cost of living {city} {country} family of 4 2025",
            "average rent {city} {country} 2 bedroom 2025",
            "groceries cost {city} {country} monthly family 2025",
            "utilities cost {city} {country} monthly 2025",
        ],
    },
    "healthcare": {
        "weight": 0.20,
        "label": "Healthcare (erişim + giderler)",
        "search_queries": [
            "healthcare system {country} expats access quality",
            "NHS {country} waiting times quality 2025",
            "private health insurance cost {country} family 2025",
            "healthcare costs {country} expats with visa 2025",
        ],
    },
    "childcare": {
        "weight": 0.20,
        "label": "Childcare/Nursery (≤3 years, 2 children)",
        "search_queries": [
            "nursery cost {city} {country} under 3 years old 2025",
            "childcare fees {city} {country} monthly per child 2025",
            "free childcare hours {country} 3 year olds 2025",
            "nursery waiting list {city} {country} 2025",
        ],
    },
    "crime_safety": {
        "weight": 0.15,
        "label": "Crime/Safety",
        "search_queries": [
            "crime rate {city} {country} 2025 statistics",
            "safety index {city} {country} 2025",
            "violent crime rate {city} {country} 2025",
            "safest areas {city} {country} families 2025",
        ],
    },
    "racism_discrimination": {
        "weight": 0.10,
        "label": "Racism/Discrimination",
        "search_queries": [
            "racism {city} {country} expats experience 2025",
            "discrimination {country} foreigners muslim 2025",
            "diversity {city} {country} multicultural 2025",
            "hate crime statistics {country} 2025",
        ],
    },
    "general_livability": {
        "weight": 0.10,
        "label": "General Livability",
        "search_queries": [
            "livability {city} {country} quality of life 2025",
            "public transport {city} {country} 2025",
            "parks green spaces {city} {country} families",
            "expat life {city} {country} pros cons 2025",
        ],
    },
}


def search_web(query: str, num_results: int = 5) -> list[dict]:
    """Search the web using available search tools."""
    # Use the firecrawl MCP if available, otherwise fall back to direct search
    # For now, use a simple approach — return empty and let the caller use
    # the MCP search tools manually
    return []


def gather_search_queries(city: str, country: str) -> dict:
    """Generate all search queries for each dimension."""
    queries = {}
    for dim_key, dim in DIMENSIONS.items():
        queries[dim_key] = [
            q.format(city=city, country=country)
            for q in dim["search_queries"]
        ]
    return queries


def generate_report(
    city: str,
    country: str,
    salary_gbp: float | None = None,
    scores: dict | None = None,
    notes: dict | None = None,
) -> str:
    """Generate the livability report markdown.

    If scores and notes are provided, use them. Otherwise, output a template
    with Unknown for manual filling.
    """
    city_slug = city.lower().replace(" ", "-")
    country_slug = country.lower().replace(" ", "-")

    if scores is None:
        scores = {k: None for k in DIMENSIONS}
    if notes is None:
        notes = {k: "" for k in DIMENSIONS}

    # Calculate weighted score
    weighted_sum = 0
    total_weight = 0
    all_scored = True
    for dim_key, dim in DIMENSIONS.items():
        score = scores.get(dim_key)
        if score is not None:
            weighted_sum += score * dim["weight"]
            total_weight += dim["weight"]
        else:
            all_scored = False

    if all_scored and total_weight > 0:
        livability_score = round(weighted_sum / total_weight, 1)
    else:
        livability_score = None

    # Determine gate
    if livability_score is None:
        gate = "Unknown"
        score_impact = "Unknown — hold until data is collected"
    elif livability_score >= 4.0:
        gate = "pass"
        score_impact = "+0.5 bonus"
    elif livability_score >= 3.0:
        gate = "pass"
        score_impact = "±0 (no adjustment)"
    elif livability_score >= 2.0:
        gate = "risk"
        score_impact = "-1.0 penalty"
    else:
        gate = "reject"
        score_impact = "-2.0 penalty"

    lines = [
        f"# Relocation Livability: {city}, {country}",
        "",
        f"**Family profile:** {FAMILY_PROFILE}",
        f"**Salary context:** £{salary_gbp:,.0f}/year" if salary_gbp else "**Salary context:** Unknown",
        f"**Last updated:** 2026-07-15",
        f"**Data freshness:** refresh every 6 months or when new city added",
        "",
        "## Scoring",
        "",
        "Each dimension scored 1-5 (5 = excellent). Weighted average = Livability Score.",
        "",
        "| Dimension | Weight | Score | Rationale |",
        "|-----------|--------|-------|-----------|",
    ]

    for dim_key, dim in DIMENSIONS.items():
        score = scores.get(dim_key)
        score_str = f"{score}/5" if score is not None else "Unknown"
        note = notes.get(dim_key, "")
        lines.append(f"| {dim['label']} | {dim['weight']:.2f} | {score_str} | {note} |")

    lines.extend([
        "",
        f"**Livability Score:** {livability_score}/5.0" if livability_score else "**Livability Score:** Unknown",
        f"**Score impact:** {score_impact}",
        f"**Livability gate:** `{gate}`",
        "",
    ])

    # Add search query reference for data gathering
    lines.extend([
        "## Search Query Reference",
        "",
        "Aşağıdaki sorgular veri toplamak için kullanılabilir (web search / firecrawl):",
        "",
    ])

    queries = gather_search_queries(city, country)
    for dim_key, dim in DIMENSIONS.items():
        lines.append(f"### {dim['label']}")
        for q in queries[dim_key]:
            lines.append(f"- `{q}`")
        lines.append("")

    # Add detailed notes section
    lines.extend([
        "## Detailed Notes",
        "",
    ])

    for dim_key, dim in DIMENSIONS.items():
        lines.append(f"### {dim['label']}")
        note = notes.get(dim_key, "")
        if note:
            lines.append(note)
        else:
            lines.append("Veri toplanacak. Yukarıdaki search query'leri kullan.")
        lines.append("")

    # Add cost breakdown template if salary provided
    if salary_gbp:
        monthly_gross = salary_gbp / 12
        lines.extend([
            "## Monthly Cost Breakdown (estimate)",
            "",
            f"**Gross monthly salary:** £{monthly_gross:,.0f}",
            "",
            "| Expense | Estimated £/month | % of gross |",
            "|---------|-------------------|------------|",
            "| Rent (2-3 bed) | ? | ? |",
            "| Council tax | ? | ? |",
            "| Utilities (gas, elec, water) | ? | ? |",
            "| Groceries (family of 4) | ? | ? |",
            "| Nursery (2 children ≤3) | ? | ? |",
            "| Transport | ? | ? |",
            "| Health insurance (private, optional) | ? | ? |",
            "| Misc (phone, internet, etc) | ? | ? |",
            "| **Total** | **?** | **?** |",
            "| **Remaining (savings) £** | **?** | |",
            "",
        ])

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Research relocation livability")
    parser.add_argument("--city", required=True, help="Target city (e.g., Cambridge)")
    parser.add_argument("--country", required=True, help="Target country (e.g., UK)")
    parser.add_argument("--salary", type=float, default=None, help="Annual salary in GBP (for cost breakdown)")
    parser.add_argument("--scores", type=str, default=None, help="JSON file with pre-filled scores")
    parser.add_argument("--notes", type=str, default=None, help="JSON file with notes per dimension")
    parser.add_argument("--output", type=str, default=None, help="Output file path")
    args = parser.parse_args()

    city_slug = args.city.lower().replace(" ", "-")
    country_slug = args.country.lower().replace(" ", "-")
    default_output = OUTPUT_DIR / f"{city_slug}-{country_slug}-livability.md"
    output_path = Path(args.output) if args.output else default_output

    scores = None
    notes = None
    if args.scores:
        with open(args.scores) as f:
            scores = json.load(f)
    if args.notes:
        with open(args.notes) as f:
            notes = json.load(f)

    report = generate_report(args.city, args.country, args.salary, scores, notes)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report, encoding="utf-8")
    print(f"Livability report written: {output_path}")
    print()
    print("Next steps:")
    print("  1. Run the search queries in the report via web search / firecrawl")
    print("  2. Fill in scores (1-5) and notes for each dimension")
    print("  3. Re-run with --scores and --notes to generate final report")
    print(f"  4. Use in triage: Livability Score from {output_path}")


if __name__ == "__main__":
    main()
