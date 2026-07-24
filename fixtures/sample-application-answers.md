# Application Form Answers — Orion Labs

**Role:** Senior Platform Engineer — AI Infrastructure
**Prepared:** 2026-07-01

---

## Why are you interested in this role?

I am drawn to this role because it sits at the intersection of platform engineering and AI infrastructure, which is exactly the career direction I am pursuing. After 6 years building internal developer platforms and infrastructure automation, I want to apply that expertise to the unique challenges of scaling ML workloads. Orion Labs' focus on AI developer tools means I would be building infrastructure that directly accelerates other engineers' productivity, which is the type of impact I find most fulfilling.

## Describe a complex infrastructure challenge you solved.

At CloudForge Inc., our deployment pipeline took 45 minutes per release, causing developers to batch changes and increasing blast radius per deploy. I led the migration to a GitOps model using Flux and ArgoCD, breaking the monolithic deploy into per-service reconciliation loops. This reduced deployment time to 8 minutes and enabled teams to ship independently. The key challenge was migrating 60+ services without downtime; I designed a progressive rollout strategy that ran both systems in parallel for 4 weeks, validating each service before cutover. We completed the migration 3 months ahead of the 6-month timeline.

## What experience do you have with GPU infrastructure? (optional)

My GPU infrastructure experience is limited but growing. I have set up basic Ray clusters for model serving prototypes and understand the fundamentals of GPU scheduling in Kubernetes (device plugins, node affinity, resource requests). I have not managed large-scale GPU clusters in production, but my track record of quickly ramping up on new infrastructure domains (Kubernetes migration in 3 months at DataStream, GitOps migration ahead of schedule at CloudForge) gives me confidence in my ability to learn this effectively.

## What is your preferred work arrangement?

Fully remote from Berlin, Germany (CET timezone). I am comfortable with occasional travel for team offsites (quarterly is ideal). I work async-first and have experience collaborating across 3+ timezones in my current distributed team.
