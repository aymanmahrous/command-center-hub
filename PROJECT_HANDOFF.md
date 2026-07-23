# Command Center Hub Project Handoff

Document status: CURRENT
Authority: OPERATIONAL
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner
Historical baseline: `PROJECT_HANDOFF.md` at commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`

## Current governance stage

`GOV-G: COMPLETED — READY FOR GOV-H`

GOV-A through GOV-F established source truth, PR organization, operation ownership, enforcement design, normalized CI and static hardening. GOV-G prepared a safe Phase 3 contract only. No execution or external connection occurred.

## Canonical Phase 3

The only authoritative identifier is `PHASE-3-SAFE-EXECUTION`.

It permits only a separately authorized, time-limited and Registry-listed operation. It prohibits Production writes, uncontrolled AI, publishing, Storage writes, Migration, browser protected credentials and any unregistered step. Missing owner, independent approval, target SHA, idempotency, concurrency, audit, kill switch or rollback causes a fail-closed decision.

GOV-G does not start Phase 3.

## Migration and Feature separation

- Every Migration must use an isolated database-only PR.
- Feature PRs must contain no Migration, DDL, RLS, policy, grant, cron, worker or schema change.
- Migration PRs must contain no UI, Feature, AI/provider, publishing, Storage or unrelated application change.
- Disposable verification and independent database/security approval are prerequisites; Production application remains separately blocked.

## AI Environment foundation

`docs/governance/AI_ENVIRONMENT_FOUNDATION.md` is `BLOCKED — DESIGN ONLY`.

- Model allowlist is empty by default.
- Token ceilings require explicit numeric approval.
- Cost ceiling is zero until explicitly approved.
- First candidate, if ever authorized, is text-only and draft-only.
- No Storage, publishing, Migration or Production database write is allowed.
- AI Operations Owner controls the kill switch; independent AI Risk approval is required.
- Audit receipt must contain model, token/cost values, run/idempotency/lock IDs, hashes and provider receipt.

## Idempotency

Controlled write candidates use durable operation identities derived from target object, intended state, request identity and expected version/hash. Exact replay must return the original receipt without a second side effect; conflicting reuse must fail. AI retries must reuse the same run/idempotency identity.

## Concurrency locks

Locks are scoped per conversation, booking, lead, content item, AI tenant/day/purpose, migration environment and external target. Concurrent same-scope requests may accept at most one mutation; conflict, lease expiry and recovery must be auditable.

## Disposable verification plan

A future database-only PR must use an empty isolated Supabase/Postgres instance, pinned tools, exact migration hashes and target SHA. The plan applies the chain, tests approved repeat/upgrade scenarios, inspects schema/RLS/grants/functions/cron/workers, captures artifacts and destroys the instance. No Production secret, data, provider, Storage or publishing connection is allowed. Command Center currently has no authorized disposable database path; the plan is a prerequisite only.

## Continuing blocked paths

PR #8, database writes, migrations, AI generation, Storage mutation, publishing, outbound messaging, Production writes, repository settings and PR metadata changes remain blocked without separate authority.

## Safety receipt

No Workflow, script, test, build, Preview, deployment, Migration, database/provider/Production connection, generation, publishing, Storage write, PR metadata change, setting change, secret change or `main` modification occurred.

## Transition gate

GOV-H may begin only under a separate explicit instruction. It must issue a final go/no-go decision; until then `PHASE-3-SAFE-EXECUTION` remains blocked.
