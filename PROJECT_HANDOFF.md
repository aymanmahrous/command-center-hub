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
4. `docs/governance/GITHUB_RULESETS_DESIGN.md` — proposed repository enforcement.
5. `docs/governance/GITHUB_ENVIRONMENTS_DESIGN.md` — proposed Environment separation.
6. `.github/CODEOWNERS` — branch-only sensitive-path ownership candidate.
7. `docs/governance/WRITE_AND_WORKFLOW_REGISTRY.md` — write/read paths, approvals, kill switches and rollback.
8. `docs/governance/RISK_OWNERSHIP_MATRIX.md` — accountable role separation.
9. `docs/governance/PR_REGISTRY.md` — PR classifications and dependencies.
10. Historical documents and PR receipts — evidence only and never executable.

## Current governance stage

`GOV-D: COMPLETED — READY FOR GOV-E`

GOV-A established the source of truth, GOV-B organized PR risk, GOV-C inventoried sensitive operations, and GOV-D prepared branch-only GitHub enforcement designs. Rulesets, Branch Protection, Code Owner enforcement and Environments are not claimed as active on `main`.

## Historical and GOV-C operational boundary

Historical evidence records controlled inbox, booking, CRM and content operations, with migrations, AI, publishing and external actions blocked. The authoritative operation inventory and role separation remain in `WRITE_AND_WORKFLOW_REGISTRY.md` and `RISK_OWNERSHIP_MATRIX.md`. No tests, builds, Workflows or external checks ran during GOV-A through GOV-D.

## GOV-B PR organization

- PR #19: `ACTIVE / DOCUMENTATION`; unchanged.
- PR #8: `STALE / REVALIDATION REQUIRED / NON-MERGE-READY`.
- PRs #9 through #18: historical evidence only.
- No active database, AI, publishing or external-messaging candidate is authorized.

## GOV-D CODEOWNERS design

`.github/CODEOWNERS` now covers:

- `.github/workflows/**`;
- `supabase/migrations/**`;
- auth, AI and booking source paths;
- `scripts/verify-*`;
- privacy documents;
- `AGENT_CONSTITUTION.md`;
- `PROJECT_HANDOFF.md`;
- governance documents.

`@aymanmahrous` is the Responsible candidate and `@pixelreel2026` is the known independent-review candidate. Their access and Code Owner eligibility must be verified before merge or activation. The file on this branch does not enforce anything on `main`.

## GOV-D Rulesets design

The proposed `main` ruleset requires PRs, independent approval, Code Owner review, stale-approval dismissal, review after last push, conversation resolution, stable required checks, blocked force-push and deletion, restricted emergency bypass, and an audit-preserving merge policy. GOV-E must establish stable required-check names before settings activation.

## GOV-D Environments design

Four isolated designs are documented:

- `preview-readonly`;
- `production-readonly`;
- `production-write`;
- `production-ai-spend`.

Each defines secret scope, allowed triggers, approvals, kill switch and rollback. Read-only environments may not contain write credentials. Write and AI-spend environments require separate named independent approval and remain inactive.

## Kill switches and rollback

The GOV-C registry remains authoritative for domain kill switches and rollback. GOV-D adds settings-level stops: disable Environment approval, revoke narrowly scoped credentials, block dispatch, cancel pending deployment, and preserve settings/run receipts. Git rollback uses a new auditable commit; history rewriting remains prohibited.

## Governance completion evidence

### GOV-A

- Source of truth, phase namespace, Constitution candidate and evidence registry established.

### GOV-B

- Open PRs classified and one-PR-per-risk-domain rules recorded.

### GOV-C

- Write/workflow registry, ownership matrix, kill switches and rollback requirements completed.

### GOV-D

- `.github/CODEOWNERS` added on the governance branch.
- `GITHUB_RULESETS_DESIGN.md` created.
- `GITHUB_ENVIRONMENTS_DESIGN.md` created.
- `GOV_D_READINESS_REPORT.md` records `GOV-D: COMPLETED — READY FOR GOV-E`.
- No repository setting, `main`, PR metadata, Workflow, deployment or external system was changed.

## Prohibited actions

- Do not modify `main` or change repository settings under this branch-only stage.
- Do not merge, revert, close, relabel, retarget or comment on PRs.
- Do not run scripts, Workflows, tests, builds, Preview or deployment.
- Do not create/apply migrations or access Supabase, AI providers, Production, secrets or external accounts.
- Do not generate, publish, schedule, message, advertise, bill or spend.

## Transition gate

GOV-D is complete as an enforcement design stage. GOV-E may begin only under a separate explicit instruction. Actual Ruleset, Branch Protection, CODEOWNERS enforcement and Environment activation require a separate settings authorization and evidence receipt.