# Command Center Hub Project Handoff

Document status: CURRENT
Authority: OPERATIONAL
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner
Historical baseline: `PROJECT_HANDOFF.md` at commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`

## Purpose

This is the current operational continuation source. Historical implementation and verification evidence remains dated evidence and is not represented as newly verified. No governance stage authorizes runtime or external execution unless a later explicit approval says so.

## Source-of-truth order

1. `AGENT_CONSTITUTION.md` — governance candidate.
2. `docs/governance/PHASE_NAMESPACE.md` — canonical phase naming.
3. This Handoff — current operational status.
4. `docs/governance/WRITE_AND_WORKFLOW_REGISTRY.md` — write/read paths, approvals, kill switches and rollback.
5. `docs/governance/RISK_OWNERSHIP_MATRIX.md` — accountable role separation.
6. `docs/governance/PR_REGISTRY.md` — PR classifications and dependencies.
7. `docs/governance/DOCUMENT_REGISTRY.md` — document authority.
8. Historical documents and PR receipts — evidence only and never executable.

## Current governance stage

`GOV-C: COMPLETED — READY FOR GOV-D`

GOV-A established the source of truth. GOV-B classified PR risk. GOV-C inventoried writes/workflows and documented ownership, approvals, kill switches and rollback. These stages authorize no merge, runtime work, database access, deployment, provider access or Production action.

## Historical implemented evidence

The pre-governance Handoff recorded the following as historical evidence:

- Inbox reads through `get_staff_inbox` and `get_staff_conversation_messages`.
- Role-gated mode changes through `set_staff_conversation_mode`, including `paused` and `human_takeover` safety states.
- Booking status writes through `update_booking_request_status`.
- CRM design evidence through `update_staff_lead_workflow`; PR #8 remains stale and non-merge-ready.
- Content editing through `update_staff_content_item` and state transitions through `transition_staff_content_item`.
- Media Library and Integrations as read-only surfaces in the reviewed historical state.
- Historical locking, confirmation, session, RBAC, audit and performance controls.

No tests, builds, Workflows or external checks were run during GOV-A, GOV-B or GOV-C.

## GOV-B PR organization

The authoritative classification remains in `docs/governance/PR_REGISTRY.md`.

- PR #19: `ACTIVE / DOCUMENTATION`; unchanged by governance stages.
- PR #8: `STALE / REVALIDATION REQUIRED / NON-MERGE-READY`; any needed CRM work must be recreated later from then-current `main` after governance enforcement.
- PRs #9 through #18: historical merged evidence only.
- No active database, AI, publishing or external-messaging candidate is authorized.

## GOV-C write and workflow registry

The authoritative registry is `docs/governance/WRITE_AND_WORKFLOW_REGISTRY.md`.

Registered domains include:

- staff inbox reads and conversation-mode writes;
- booking reads and controlled status writes;
- CRM writes, currently blocked because PR #8 is stale;
- content editing and review/schedule transitions;
- governance branch commits and PR-governance operations;
- database migrations/RLS/policies/cron/workers, blocked;
- AI/provider generation, frozen/blocked;
- publishing and outbound messaging, frozen/blocked.

For each path the registry records target, trigger, allowed environment, role, secret scope, human approval, idempotency, audit receipt, rollback, owner, independent approver and status.

## GOV-C risk ownership

The authoritative matrix is `docs/governance/RISK_OWNERSHIP_MATRIX.md`.

Every sensitive domain now has accountable role names for:

- Responsible;
- Independent approver;
- Kill switch owner;
- Rollback owner.

These are role assignments, not claims that named individuals have accepted them. Missing named assignments keep protected activation blocked. The Responsible person may not be the sole approver/operator.

## Kill switches

- Conversation mode: disable mutation UI or move affected conversations to `paused`/`human_takeover` through an approved RPC.
- Booking: disable status controls and, where required, revoke affected write permission while retaining read access.
- CRM: keep PR #8 unmerged and CRM read-only.
- Content: disable edit/transition/scheduling controls; retain items in last confirmed state.
- Database: do not dispatch/apply; lock the protected environment and perform read-only review.
- AI/provider: disable the dedicated credential/feature gate; reject new requests and preserve audit IDs.
- Publishing/outbound: disable scheduler/adapter and revoke the scoped token; reconcile ambiguous receipts.
- Governance: stop branch commits and revert only through a new auditable commit.

## Rollback procedures

Rollback must be a new auditable action and may not rewrite Git history. The minimum receipt includes affected path, actor, approver, before-state, after-state, commit/request/run ID, timestamps, verification result and unresolved side effects.

- Controlled database state changes use an approved compensating RPC/state transition where valid.
- Content restoration uses preserved before-state and an approved RPC.
- Database schema recovery uses an approved forward-fix/compensating migration or backup/PITR plan; historical migrations are never edited.
- Provider/publishing recovery first stops new actions, then reconciles remote receipts before any correction or unpublish action.
- Governance rollback uses a new branch commit, never force push or amend.

## Governance completion evidence

### GOV-A

- Source of truth, phase namespace, Constitution candidate, Document Registry and no-execution receipt established.

### GOV-B

- Every open PR inventoried and classified; PR #8 marked stale and non-merge-ready; one-PR-per-risk-domain rules recorded.

### GOV-C

- `docs/governance/WRITE_AND_WORKFLOW_REGISTRY.md` created.
- `docs/governance/RISK_OWNERSHIP_MATRIX.md` created.
- CRM, booking, content, AI, migration, publishing, staff and governance operations registered.
- Kill switches, rollback procedures, owners and independent approvers documented.
- `docs/governance/GOV_C_READINESS_REPORT.md` records `GOV-C: COMPLETED — READY FOR GOV-D`.
- No code, PR state, `main`, Workflow, database, provider or external system was changed.

## Prohibited actions

- Do not modify `main`, merge, revert, close, relabel, retarget or comment on PRs under GOV-C.
- Do not run scripts, Workflows, tests, builds, Preview or deployment.
- Do not create/apply migrations, RLS, policies, cron or workers.
- Do not access Supabase, AI providers, Production, secrets or external accounts.
- Do not expose service-role credentials or write directly to tables.
- Do not generate media, publish, schedule, message, advertise, bill or spend.
- Do not modify or deploy the public Relax Fix UAE site.

## Transition gate

GOV-C is complete on this branch. GOV-D may begin only under a separate explicit instruction and must remain within the authorized scope.
