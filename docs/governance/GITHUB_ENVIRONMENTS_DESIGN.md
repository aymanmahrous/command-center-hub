# GitHub Environments Design

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

## Truth boundary

These Environments are proposed only. GOV-D does not create them, add secrets, approve deployments, or connect to Production.

| Environment | Secret scope | Allowed triggers | Required approvals | Kill switch | Rollback |
|---|---|---|---|---|---|
| `preview-readonly` | Browser-safe public identifiers only; no service-role, DB password, provider token, publishing token, or write credential | PR only after source checks | 1 independent reviewer for sensitive paths | Disable Environment or remove deployment permission; cancel pending deployment | Redeploy last approved Preview SHA or delete isolated Preview; record deployment receipt |
| `production-readonly` | Read-only verification credentials with minimum scope; no mutation-capable token | Manual only from protected `main` SHA | Release Verification Owner + Independent Release Reviewer | Disable Environment approvals and revoke read-only credential | Stop verification, rotate/revoke credential if exposed, preserve logs and record no-write evidence |
| `production-write` | Narrow operation-specific credentials; never browser-exposed; separate per write domain | Manual `workflow_dispatch` only from exact protected `main` SHA | Responsible domain owner + independent approver + Release Owner | Disable Environment, revoke scoped credential, disable mutation route/feature gate | Execute documented domain rollback, verify before/after state and audit receipt |
| `production-ai-spend` | AI provider token, model allowlist and cost ceiling only; separated from publishing/storage credentials | Manual only; no schedule or push trigger | AI Operations Owner + Independent AI Risk Approver + Repository Owner | Disable Environment, revoke provider token, set AI feature gate off | Stop requests, preserve provider/request receipts, reconcile spend, revert application SHA if needed |

## Shared rules

1. Environment secrets must not be copied between environments.
2. `preview-readonly` and `production-readonly` may never contain write-capable credentials.
3. `production-write` and `production-ai-spend` require named reviewers and cannot allow self-approval.
4. Branch policy must restrict protected environments to `main` or approved release tags.
5. Every protected run records actor, approval, SHA, environment, reason, start/end time, target, receipt and rollback owner.
6. No Environment may be configured until GOV-D settings activation is separately authorized.

## Current repository decision

Command Center has no authorized Production deployment or provider operation under this governance branch. All four designs remain inactive and blocked pending settings verification, named role assignment and GOV-E check normalization.
