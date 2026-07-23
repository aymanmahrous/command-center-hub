# Command Center Hub Project Handoff

Document status: CURRENT
Authority: OPERATIONAL
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner
Historical baseline: `PROJECT_HANDOFF.md` at commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`

## Purpose

This file preserves the complete operational evidence that existed before Documentation Review PR #19 while replacing obsolete execution instructions with the current governance state. No historical implementation evidence below is deleted or recharacterized as newly verified.

## Source-of-truth order

1. `AGENT_CONSTITUTION.md` — governance candidate.
2. `docs/governance/PHASE_NAMESPACE.md` — canonical phase naming.
3. This Handoff — current operational status.
4. `docs/governance/DOCUMENT_REGISTRY.md` — classification and authority.
5. Historical documents — evidence only and never executable.

## Current governance stage

`GOV-A: COMPLETED — READY FOR GOV-B`

This completion covers documentation governance only. It does not authorize merge, runtime work, database access, deployment, or any external action.

## Unified phase model

Governance work uses `GOV-A` through `GOV-H`.

Product work uses descriptive identifiers, including:

- `PRODUCT-COMMAND-CENTER-PERSISTENT-FOUNDATION`
- `PRODUCT-COMMAND-CENTER-SECURITY`
- `PRODUCT-CRM-CONTROLLED-WRITES`
- `PRODUCT-CONTENT-OPERATIONS`

Bare phase numbers are not authoritative.

## Historical implemented evidence

The following evidence is preserved from the pre-PR-19 Handoff and remains historical unless separately reverified:

- Real conversation list through `get_staff_inbox`.
- Real message history through `get_staff_conversation_messages`.
- Confirmed, role-gated mode changes through `set_staff_conversation_mode`.
- Supported modes: `ai_active`, `human_required`, `human_takeover`, and `paused`.
- In-flight locking, bounded errors, session-expiry handling, and responsive UI.
- Bookings status writes restricted to `update_booking_request_status` with confirmation and locking.
- Content editing restricted to `update_staff_content_item`; review/schedule transitions restricted to `transition_staff_content_item`.
- Content mutations use server-aligned RBAC, confirmation, locking, session handling, and RPC-provided audit evidence.
- Media Library was documented as read-only with no upload, generation, update, deletion, or private Storage URL exposure.
- Analytics exposed aggregate metrics while retaining attribution limitations.
- Integrations exposed the operations queue read-only and did not expose retry, cancel, provider test, credentials, webhook, or direct-table actions.
- Dependency locking, script-free CI installation, browser-key restrictions, session revalidation, and performance budgets were documented.

## Historical verification evidence

The pre-PR-19 Handoff recorded:

- TypeScript, tests, and production build results dated 2026-07-22.
- Independent approvals and required checks for PRs #9 through #17.
- Increasing historical test counts through the Final Security and Performance reviews.
- No migration, RLS/policy, cron, worker, public-site, direct-table-write, or service-role change in those reviewed branches.

These are dated evidence, not proof of the current branch state. No tests or builds were run during GOV-A.

## Current pull-request classification relevant to GOV-A

### PR #19 — Documentation Review

Classification: `ACTIVE`

Scope: documentation reconciliation and documentation contract tests. It must be reviewed against this branch before any later merge decision. GOV-A does not merge, close, or modify PR #19.

### PR #8 — Controlled CRM workflow updates

Classification: `STALE — REVALIDATION REQUIRED`

Reason: it introduces controlled CRM writes and predates later security and documentation baselines. It must not be considered merge-ready. A future decision should either close it as superseded or recreate the required scope from current `main` after GOV-B/C controls exist.

## Historical instruction retirement

The former section `NEXT_REQUIRED_ACTION` directed the project to open a Performance Review PR and then begin Documentation Review. That instruction is obsolete because Performance Review PR #18 was merged and Documentation Review PR #19 already exists. It has been removed from the current Handoff.

Any `NEXT_REQUIRED_ACTION` found in a document classified `HISTORICAL` or `SUPERSEDED` is evidence text only and has no authority.

## Document handling rule

- `CURRENT`: authoritative now.
- `DRAFT`: proposed and not authoritative.
- `BLOCKED`: missing a named dependency or approval.
- `HISTORICAL`: dated evidence with no executable instruction.
- `SUPERSEDED`: replaced by a named source with no executable instruction.

Documents not yet carrying an inline header are governed by their entry in `docs/governance/DOCUMENT_REGISTRY.md`.

## GOV-A completion evidence

- Complete pre-PR-19 Handoff evidence retained in this non-destructive rewrite.
- Obsolete execution instruction removed.
- Current governance stage recorded.
- Unified phase namespace recorded.
- PR #19 and PR #8 classifications recorded without modifying those PRs.
- Document Registry, Constitution candidate, change scope, and no-execution receipt present.

## Prohibited actions

- Do not modify `main`, merge, revert, or close PRs during this stage.
- Do not run scripts, Workflows, tests, builds, Preview, or deployment.
- Do not create or edit migrations, RLS, policies, cron, or workers.
- Do not access Supabase, AI providers, Production, secrets, or external accounts.
- Do not expose service-role credentials or write directly to tables.
- Do not generate media, publish, schedule, message, advertise, bill, or spend.
- Do not modify or deploy the public Relax Fix UAE site.

## Transition gate

GOV-A is complete on this branch. GOV-B may begin only under a separate explicit instruction and must remain governance-only.