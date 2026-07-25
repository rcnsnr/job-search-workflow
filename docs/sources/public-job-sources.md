# Public Job Sources Quickstart

## Purpose

This is a public-safe, example registry of job sources that a Job Search Workflow user can
use to bootstrap their own source discovery. It contains no personal data.

The authoritative source catalog in a private deployment should be maintained in
`docs/sources/company-catalog-v1.csv` and kept in sync with this quickstart.

## Example Sources

### Official company career pages

| Source | Homepage | Jobs URL | Notes |
| --- | --- | --- | --- |
| Scalar | <https://scalar.com/> | <https://jobs.ashbyhq.com/scalar> | API/MCP developer tooling; remote-first with timezone overlap preferred. |
| Axelera AI | <https://www.axelera.ai/> | <https://jobs.ashbyhq.com/axelera> | Edge AI accelerator platform; remote EU/UK/US. |
| Seon | <https://seon.io/> | <https://jobs.ashbyhq.com/seon> | Fraud-prevention SaaS; SRE roles in Europe. |
| CloudLinux | <https://www.cloudlinux.com/> | <https://apply.workable.com/cloudlinux-1> | Cloud OS / KernelCare; global remote infrastructure roles. |

### ATS-hosted public surfaces

| Source | Homepage | Jobs URL | Notes |
| --- | --- | --- | --- |
| Pragmatike | <https://www.pragmatike.com/> | <https://jobs.ashbyhq.com/pragmatike> | AI infrastructure / GPU inference roles, remote EMEA. |
| Ohalo | <https://www.ohalo.co/> | <https://apply.workable.com/ohalo> | Data-governance DevOps; remote with London overlap. |

### Discovery boards and indexes

| Source | URL | Notes |
| --- | --- | --- |
| Not Yet Unicorns | <https://notyetunicorns.com/browse> | UK early-stage startup board with remote and stack filters. |
| Open Source Pledge Jobs | <https://opensourcepledge.com/jobs/> | Aggregated postings from companies that support open-source maintainers. |
| Hacker News Who is Hiring | <https://news.ycombinator.com/item?id=48747976> | High-volume startup thread; use an indexer or keyword search to filter. |
| HubMub | <https://www.hubmub.com/jobs> | Generalist aggregator with remote, visa, and relocation filters. |

## Admission Criteria

A source can be used when:

- access method is public and allowed
- no login-wall, paywall, robots, rate-limit, or anti-bot bypass is required
- filters can target SRE / Platform / DevOps / Reliability roles
- timezone and work model can be inferred or filtered
- source provenance can be recorded

## Intake Rule

Save promising postings as raw Markdown under `inbox/jobs/YYYY-MM-DD-company-role.md`
and run job triage. Do not evaluate from unsaved browser state.
