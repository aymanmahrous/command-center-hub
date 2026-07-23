# Pull Request Registry

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner

## Classification model

- `ACTIVE`: the single current candidate in its risk domain.
- `BLOCKED`: cannot advance because a named dependency or approval is missing.
- `STALE`: based on an obsolete baseline and requires recreation or full revalidation.
- `SUPERSEDED`: replaced by a newer source or PR.
- `HISTORICAL`: merged or closed evidence only.
- `FROZEN`: intentionally prevented from advancing until later governance gates close.
- `OVERLAPPING`: duplicates or conflicts with another active scope.

These are governance classifications on branch `agent/phase-a-source-of-truth`. They do not change GitHub PR state, labels, reviewers, or mergeability.

## Open PR inventory

| PR | Scope type | Risk domain | GOV-B classification | Merge readiness | Governance decision |
|---|---|---|---|---|---|
| #19 — Documentation Review | Documentation and documentation contracts | Documentation/governance | `ACTIVE` | Review candidate only; merge not authorized by GOV-B | Remains the only active PR in the documentation domain. Reconcile its useful changes with this governance branch before any later merge decision. |
| #8 — Controlled CRM workflow updates | Functional controlled-write change | CRM/database mutation interface | `STALE / REVALIDATION REQUIRED` | `NON-MERGE-READY` | Its base predates later security, performance, and governance baselines and GitHub reports it as non-mergeable. Preserve as evidence; recreate the needed scope from current `main` only after GOV-C, GOV-D, and GOV-E gates. |

## Historical PR inventory

PRs #9 through #18 are `HISTORICAL` merged implementation and review evidence. They do not occupy an active risk slot and do not authorize new execution.

## One-PR-per-risk-domain rule

- Documentation/governance: PR #19 is the only active candidate.
- CRM controlled writes: no active candidate; PR #8 is stale and non-merge-ready.
- Database, deployment, AI, publishing, and external messaging: no active candidate is authorized by this registry.

A new PR may enter a sensitive domain only after the existing entry is closed, superseded, or formally reclassified, and after its prerequisite governance stage is complete.

## Dependency order

1. GOV-B records classification and dependency order only.
2. GOV-C creates the Write/Workflow Registry and assigns owners/approvers.
3. GOV-D verifies and designs GitHub enforcement, CODEOWNERS, Rulesets, and Environments.
4. GOV-E normalizes CI and required checks.
5. Only then may a new `PRODUCT-CRM-CONTROLLED-WRITES` PR be created from current `main`.
6. Any future CRM PR must be isolated from migrations, provider work, deployment settings, and unrelated modules.

## Evidence versus functional separation

- PR #19 is documentation/evidence governance.
- PR #8 is functional product code with a write path.
- Evidence PRs cannot authorize functional merge or Production action.
- Functional PRs cannot use historical test results as current readiness evidence.

## Safety receipt

No PR was closed, relabeled, commented on, converted, merged, rebased, or otherwise modified. No script, Workflow, test, build, Preview, deployment, migration, Supabase connection, AI-provider connection, generation, publishing, or Production operation was performed.