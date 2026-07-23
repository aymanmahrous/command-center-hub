# Command Center Hub Project Handoff

Document status: CURRENT
Authority: OPERATIONAL
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner
Historical baseline: `PROJECT_HANDOFF.md` at commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`

## Current governance stage

`GOV-F: COMPLETED — READY FOR GOV-G`

GOV-A through GOV-E established source truth, PR classification, operation ownership, GitHub enforcement design and normalized CI. GOV-F completed static risk reduction on this governance branch only. No Workflow, script, test, build, Preview, deployment or external system was run.

## GOV-F improvements

- Reviewed all declared dependencies and devDependencies; no removal was made without executed evidence.
- Added `docs/governance/DEPENDENCY_REVIEW_GOV_F.md`.
- Added deny-by-default browser runtime write rules to `WRITE_AND_WORKFLOW_REGISTRY.md`.
- Added `docs/governance/PRODUCTION_HOST_ALLOWLIST.md`; the Command Center Production read allowlist remains empty until an exact host is verified.
- Added `docs/governance/SECRETS_SCOPE_MAP.md`.
- Confirmed no active repository Workflow is designed to perform Production writes.
- Database, AI, Storage, publishing, messaging and Production-write paths remain blocked.

## Browser runtime prohibited paths

Browser/client code may not perform direct table POST/PATCH/PUT/DELETE, hold service-role or provider secrets, administer migrations/RLS/grants/cron/workers, mutate elevated Storage, call AI with protected credentials, publish, schedule, send outbound messages, or invoke unregistered RPCs.

Named staff RPCs remain classified as controlled server-enforced writes, but GOV-F does not authorize their execution or Production activation. PR #8 remains stale and non-merge-ready.

## Production host allowlist

Deny by default. No exact Command Center Production hostname is approved by GOV-F. Preview, Supabase, provider, Storage, webhook and arbitrary deployment hosts are excluded.

## Secrets scope

- Read-only/browser environments may contain only verified public identifiers or read-only credentials.
- Service-role/database credentials belong only to a future protected `production-write` environment.
- AI keys belong only to `production-ai-spend`.
- Storage and publishing tokens require separate protected environments.
- No secret value is recorded in governance files; actual GitHub secret inventories were not queried.

## Verification limitation

Dependency usage, secret absence and Workflow behavior were reviewed statically. The normalized supply-chain job and checks were not run. Rulesets, required checks, CODEOWNERS enforcement and Environments are not active on `main`.

## Safety boundary

Do not modify `main`, change PR metadata or repository settings, run Workflows/scripts/tests/builds, deploy, connect to Production/Supabase/providers, generate, publish, schedule, message, modify secrets or spend.

## Transition gate

GOV-F is complete on this branch. GOV-G may begin only after a separate explicit instruction.