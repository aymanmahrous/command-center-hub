# Command Center Hub Project Handoff

Document status: CURRENT
Authority: OPERATIONAL
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner
Historical baseline: `PROJECT_HANDOFF.md` at commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`

## Purpose

This file preserves the complete operational evidence that existed before Documentation Review PR #19 while replacing obsolete execution instructions with the current governance state. Historical implementation and verification evidence is retained as dated evidence and is not represented as newly verified.

## Source-of-truth order

1. `AGENT_CONSTITUTION.md` — governance candidate.
2. `docs/governance/PHASE_NAMESPACE.md` — canonical phase naming.
3. This Handoff — current operational status.
4. `docs/governance/PR_REGISTRY.md` — current PR classification and dependency order.
5. `docs/governance/DOCUMENT_REGISTRY.md` — document classification and authority.
6. Historical documents and PR receipts — evidence only and never executable.

## Current governance stage

`GOV-B: COMPLETED — READY FOR GOV-C`

GOV-A established the source of truth. GOV-B classified and organized PR risk domains. Neither stage authorizes merge, runtime work, database access, deployment, or external action.

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
- Booking status writes restricted to `update_booking_request_status` with confirmation and locking.
- Content editing restricted to `update_staff_content_item`; review/schedule transitions restricted to `transition_staff_content_item`.
- Content mutations documented with server-aligned RBAC, confirmation, locking, session handling, and RPC-provided audit evidence.
- Media Library documented as read-only with no upload, generation, update, deletion, or private Storage URL exposure.
- Analytics documented as aggregate-only while retaining attribution limitations.
- Integrations documented as read-only without retry, cancel, provider test, credentials, webhook, or direct-table actions.
- Dependency locking, script-free CI installation, browser-key restrictions, session revalidation, and performance budgets were documented.

## Historical verification evidence

The pre-PR-19 Handoff recorded:

- TypeScript, tests, and production build results dated 2026-07-22.
- Independent approvals and required checks for PRs #9 through #17.
- Increasing historical test counts through Final Security and Performance reviews.
- No migration, RLS/policy, cron, worker, public-site, direct-table-write, or service-role change in those reviewed branches.

These are dated receipts, not proof of the current governance branch. No tests, builds, or Workflows were run during GOV-A or GOV-B.

## GOV-B pull-request organization

The authoritative classification is in `docs/governance/PR_REGISTRY.md`.

### PR #19 — Documentation Review

Classification: `ACTIVE / DOCUMENTATION`

- It is the only active candidate in the documentation/governance risk domain.
- It contains documentation reconciliation and documentation contract-test changes.
- Its historical verification claims were not rerun during GOV-B.
- GOV-B does not merge, close, relabel, comment on, or otherwise modify PR #19.
- Before any later merge decision, its useful changes must be reconciled against this governance branch and the current Handoff.

### PR #8 — Controlled CRM workflow updates

Classification: `STALE / REVALIDATION REQUIRED / NON-MERGE-READY`

- It introduces a controlled CRM mutation path using `update_staff_lead_workflow`.
- Its described RBAC, confirmation, schema-validation, locking, and audit boundaries remain design evidence.
- Its base predates later security, performance, documentation, and governance baselines.
- GitHub reports the PR as non-mergeable.
- It must not be merged or treated as current implementation.
- Any required CRM scope must be recreated from then-current `main` after GOV-C, GOV-D, and GOV-E gates.

### Historical PR evidence

PRs #9 through #18 are `HISTORICAL` merged implementation/review receipts. They do not occupy active risk slots and authorize no new execution.

## One-PR-per-risk-domain decision

- Documentation/governance: PR #19 only.
- CRM controlled writes: no active candidate; PR #8 is stale.
- Database, AI, deployment, publishing, and external messaging: no active candidate is authorized.

A sensitive domain may receive a new PR only after the existing entry is closed, superseded, or formally reclassified and its prerequisite governance stage is complete.

## Dependency order

1. GOV-B classification and dependency recording — completed.
2. GOV-C Write/Workflow Registry and accountable owners/approvers.
3. GOV-D Rulesets, Branch Protection, CODEOWNERS, and Environments.
4. GOV-E CI normalization and required checks.
5. A future isolated `PRODUCT-CRM-CONTROLLED-WRITES` PR recreated from current `main`.

Any future CRM PR must remain separate from migrations, deployment settings, AI/provider work, publishing, and unrelated modules.

## Historical instruction retirement

The former `NEXT_REQUIRED_ACTION` directed the project to open Performance Review and then begin Documentation Review. It is obsolete because Performance Review PR #18 was merged and Documentation Review PR #19 exists.

Any `NEXT_REQUIRED_ACTION`, `Next required action`, `Resume instruction`, or equivalent wording in `HISTORICAL` or `SUPERSEDED` content is evidence only and has no authority.

## Document handling rule

- `CURRENT`: authoritative now.
- `DRAFT`: proposed and not authoritative.
- `BLOCKED`: missing a named dependency or approval.
- `HISTORICAL`: dated evidence with no executable instruction.
- `SUPERSEDED`: replaced by a named source with no executable instruction.

Documents without an inline header are governed by `docs/governance/DOCUMENT_REGISTRY.md`.

## Governance completion evidence

### GOV-A

- Complete pre-PR-19 Handoff evidence retained.
- Obsolete execution instruction retired.
- Unified phase namespace and Constitution candidate recorded.
- Document Registry, change scope, and no-execution receipt established.

### GOV-B

- Every open PR inventoried and classified.
- PR #19 retained as the only active documentation candidate.
- PR #8 re-evaluated as stale and non-merge-ready.
- Evidence and functional scopes separated.
- One-PR-per-risk-domain and dependency rules documented.
- `docs/governance/PR_REGISTRY.md` and `docs/governance/GOV_B_READINESS_REPORT.md` added.
- No actual PR state was changed.

## Prohibited actions

- Do not modify `main`, merge, revert, close, relabel, or retarget PRs under this governance stage.
- Do not run scripts, Workflows, tests, builds, Preview, or deployment.
- Do not create or edit migrations, RLS, policies, cron, or workers.
- Do not access Supabase, AI providers, Production, secrets, or external accounts.
- Do not expose service-role credentials or write directly to tables.
- Do not generate media, publish, schedule, message, advertise, bill, or spend.
- Do not modify or deploy the public Relax Fix UAE site.

## Transition gate

GOV-B is complete on this branch. GOV-C may begin only under a separate explicit instruction and must remain governance-only.