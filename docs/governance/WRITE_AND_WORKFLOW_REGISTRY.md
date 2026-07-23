# Write and Workflow Registry

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

## Governing rules

Browser code is deny-by-default for writes. No direct table write, protected credential, Storage mutation, publication, outbound message, Migration or deployment action may originate in the browser. Only named server-enforced operations may be considered. `PHASE-3-PREP` authorizes no execution.

No step may enter `PHASE-3-SAFE-EXECUTION` unless it is listed here with owner, approver, environment, idempotency, concurrency, audit, kill switch and rollback.

## Phase 3 safe-operation registry

| Repository | Operation name | Classification | Allowed environment | Required approvals | Required checks | Required secrets scope | Kill switch | Rollback | Audit receipt | Idempotency | Concurrency lock | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `aymanmahrous/command-center-hub` | `source-only-verification` | Read-only source/test/build verification; no external write | Isolated runner or GitHub Actions on exact branch SHA; no Preview or Production access | Repository Owner; named Operator; independent reviewer distinct from author/operator; Security approval if runner/environment scope changes | `verify:source`, `verify:ci`, `verify:release`, `test:unit`, `test:security`, `test:contracts` on exact target SHA | Repository read token only; no database, Supabase service role, AI, Storage-write, publishing, webhook or Production secret | Cancel run and disable dispatch/runner access; preserve logs and check receipts | No state rollback expected; if governance/configuration caused the run, revert only through a new auditable branch commit | Repository, branch, target SHA, operator, approver, start/end/expiry, exact check contexts and run IDs, input/config hashes, final PASS/FAIL and unresolved effects | Operation identity = repository + exact target SHA + check set; replay must reference the same run/receipt or create a separately identified rerun without external side effect | One active verification set per repository + target SHA; runner/workflow concurrency group cancels or rejects duplicate in-flight attempts | `ALLOWED-FOR-PHASE-3` |
| `aymanmahrous/command-center-hub` | `preview-readonly-verification` | Read-only HTTP/browser verification; GET/HEAD only; no mutation | `preview-readonly` against one exact approved HTTPS Preview URL and exact target SHA | Repository Owner; named Operator; independent reviewer distinct from author/operator; Security/Release approval of URL and secret inventory | All `source-only-verification` checks successful on exact SHA plus `test:e2e:preview` | No secrets preferred; otherwise only verified read-only access token. No database/service-role, AI, Storage-write, publishing, webhook, messaging or Production-write credential | Cancel run; disable `preview-readonly` approval; revoke scoped read token; block the URL if scope mismatch appears | Stop verification and discard transient browser state/artifacts as allowed; no remote state change is permitted; Git changes revert by new auditable commit only | Repository, branch, target SHA, exact URL/host, environment, operator/approver, check/run IDs, request methods, response summary, console/network failures, secret-scope attestation, start/end/expiry and final PASS/FAIL | Operation identity = target SHA + normalized Preview URL + verifier version; exact replay is read-only and receives a distinct run ID linked to the prior receipt | One active Preview verification per repository + target SHA + normalized URL; cancel/reject overlapping runs | `ALLOWED-FOR-PHASE-3` |

`ALLOWED-FOR-PHASE-3` means eligible for a future activation review only. It does not authorize automatic dispatch or execution. A separate explicit order and complete PASS under `PHASE_3_ACTIVATION_GATE.md` remain mandatory.

## Migration separation rule

- Every future Migration must use a database-only PR.
- A Feature PR must contain no file under `supabase/migrations/**`, no DDL/RLS/grant/policy/cron/worker/schema change and no migration runner.
- A Migration PR must contain no UI, feature, AI/provider, publishing, Storage or unrelated application behavior.
- Migration verification is disposable-only until a separate Production authorization.
- Historical migrations are immutable; recovery uses a forward-fix/compensating migration or approved restore plan.

## Registered paths and controls

| Path | Target | Status | Idempotency requirement | Concurrency lock |
|---|---|---|---|---|
| `get_staff_inbox`, `get_staff_conversation_messages` | Database read | Current read path | N/A | optional request dedupe only |
| `set_staff_conversation_mode` | Database | BLOCKED | key: conversation + intended mode + request identity; duplicate returns prior receipt | one in-flight mutation per conversation |
| `update_booking_request_status` | Database | BLOCKED | key: booking + intended status + request identity; reject unchanged/replay | one status transition per booking |
| `update_staff_lead_workflow` | Database | BLOCKED; PR #8 stale | key: lead + intended workflow state + request identity | one mutation per lead |
| `update_staff_content_item` | Database | BLOCKED | key: content item + version/hash + request identity | optimistic version plus one mutation per item |
| `transition_staff_content_item` | Database/scheduling state | BLOCKED; publishing excluded | key: item + from/to state + content fingerprint | one transition per item; scheduler lock required if later approved |
| AI generation | Provider/draft audit | BLOCKED | immutable run ID + request key + input hash; retries reuse identity | lock by tenant/day/purpose or content fingerprint |
| Governance branch commit | Git branch | Current under explicit instruction | commit SHA/path set; no duplicate content commit | one sequential update per file/ref |
| PR metadata/merge/settings | GitHub | BLOCKED | operation identity and expected state | one protected operation per PR/repository setting |
| Migration/RLS/policy/cron/worker | Disposable database only in future | BLOCKED | migration filename/version + target SHA + run ID | one migration-chain run per disposable environment |
| Publishing/outbound/Storage writes | External systems | BLOCKED | provider/object request ID + content hash | one operation per content/object/provider target |

## Idempotency verification design

For each write candidate, verification must demonstrate: first request succeeds once; exact replay returns the original result without a second side effect; conflicting payload with the same key is rejected; retry after timeout reconciles the original receipt; audit records contain one durable operation identity. No such test was run by PHASE-3-PREP.

## Concurrency verification design

Verification must demonstrate: two simultaneous requests for the same lock scope produce at most one accepted mutation; the loser receives a bounded conflict/in-progress result; expired locks are recoverable; lock owner/run ID and timestamps are auditable; unrelated scopes may proceed independently. No such test was run by PHASE-3-PREP.

## Browser runtime blocklist

Prohibited: direct REST table mutations; service-role/database/provider secrets; elevated Storage writes; migration/DDL/RLS/grants/cron/workers; protected AI calls; publishing/scheduling/webhooks/messages; unregistered RPCs; Production-host writes.

## Disposable Migration-chain verification plan — not authorized to run

1. Require a database-only PR and exact target SHA.
2. Create an isolated disposable Supabase/Postgres instance with no Production secrets or data.
3. Record tool versions and hashes: pinned Supabase CLI, PostgreSQL client, Node/npm, shell and migration files.
4. Apply the exact repository migration chain from empty state.
5. Repeat the chain/idempotency scenario where supported and test legacy/upgrade paths from approved fixtures.
6. Inspect schema, RLS, grants, functions, cron/workers and migration-history diffs.
7. Run read-only post-checks and verify no external network/provider/Storage/publishing action.
8. Capture logs, artifacts, target SHA, migration hashes, elapsed time and destroy the disposable environment.
9. Independent database/security reviewer decides pass/fail; failure does not authorize a Production fix.

Required tools are documented only: pinned `supabase/setup-cli`, Supabase CLI, Docker/local containers where approved, PostgreSQL client, repository migration scripts and SQL verification files. None was invoked.

Kill switches, ownership and rollback evidence remain governed by `RISK_OWNERSHIP_MATRIX.md`, `AI_ENVIRONMENT_FOUNDATION.md` and GOV-C records.
