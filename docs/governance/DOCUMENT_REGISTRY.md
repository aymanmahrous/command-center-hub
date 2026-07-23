# Document Registry

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner

## Allowed classifications

- `CURRENT`: authoritative operating source.
- `DRAFT`: proposed and not authoritative.
- `BLOCKED`: incomplete because a dependency or approval is missing.
- `HISTORICAL`: dated evidence only; no executable instruction.
- `SUPERSEDED`: replaced by a named source; no executable instruction.

Registry classifications govern historical files even where an inline header has not yet been added.

## Canonical documents

| Path | Classification | Authority | Notes |
|---|---|---|---|
| `AGENT_CONSTITUTION.md` | DRAFT | GOVERNANCE | GOV-A candidate for later factual review and merge decision. |
| `PROJECT_HANDOFF.md` | CURRENT | OPERATIONAL | Current source of operational continuation. |
| `docs/governance/PHASE_NAMESPACE.md` | CURRENT | GOVERNANCE | Canonical GOV and PRODUCT naming. |
| `docs/governance/DOCUMENT_REGISTRY.md` | CURRENT | GOVERNANCE | This registry. |
| `docs/governance/GOV_A_READINESS_REPORT.md` | CURRENT | EVIDENCE | GOV-A completion decision. |
| `docs/governance/CHANGE_SCOPE.md` | HISTORICAL | EVIDENCE | Records the original GOV-A scope only. |
| `docs/governance/NO_EXECUTION_RECEIPT_2026-07-23.md` | HISTORICAL | EVIDENCE | Immutable no-execution receipt. |

## Handoff and historical evidence

| Source | Classification | Notes |
|---|---|---|
| Current `PROJECT_HANDOFF.md` | CURRENT | Preserves the full pre-PR-19 evidence and retires obsolete instructions. |
| `PROJECT_HANDOFF.md` at `312c30b...` | HISTORICAL | Complete pre-PR-19 baseline. Its `NEXT_REQUIRED_ACTION` is non-executable evidence. |
| Handoff/stage documents predating the current file | HISTORICAL or SUPERSEDED | Cannot authorize execution. |

## Pull-request documents

| PR | Classification | Notes |
|---|---|---|
| #19 | ACTIVE / DOCUMENTATION | Current documentation reconciliation candidate; no runtime authority. |
| #8 | STALE / REVALIDATION REQUIRED | Controlled CRM-write scope predates later security/governance baselines. |
| #9–#18 merged evidence | HISTORICAL | Dated implementation/review receipts retained in the current Handoff. |

## Directory-level inventory

| Scope | Default classification | Rule |
|---|---|---|
| `docs/governance/**` | CURRENT or HISTORICAL as listed | Explicit governance authority. |
| root Handoff/README guidance | CURRENT-REVIEW-REQUIRED | Current Handoff prevails on conflict. |
| feature/stage handoffs | HISTORICAL or SUPERSEDED | Evidence only; no next action. |
| security/performance review documents | HISTORICAL-EVIDENCE unless expressly current | Results are dated and do not authorize deployment. |
| PR bodies/comments | HISTORICAL-EVIDENCE | Never replace current source-of-truth documents. |

## Historical instruction rule

Any `NEXT_REQUIRED_ACTION`, `Next required action`, `Resume instruction`, or equivalent text inside `HISTORICAL` or `SUPERSEDED` content is non-executable. The obsolete instruction to open Performance Review and then begin Documentation Review was removed from the current Handoff because PR #18 is merged and PR #19 already exists.

## GOV-A inventory decision

The Constitution, Handoff, evidence PRs, governance documents, operational documents, historical/superseded/draft classes, `CHANGE_SCOPE`, and `NO_EXECUTION_RECEIPT` are covered by explicit file or directory classifications. Later header insertion into every retained historical file is cleanup only and cannot change authority.