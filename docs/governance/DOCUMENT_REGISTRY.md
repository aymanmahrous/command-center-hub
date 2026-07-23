# Document Registry

Document status: CURRENT-CANDIDATE
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner

## Classification rules

Allowed statuses: `CURRENT`, `DRAFT`, `BLOCKED`, `HISTORICAL`, `SUPERSEDED`.

- `CURRENT`: authoritative operating source.
- `DRAFT`: proposed and not yet authoritative.
- `BLOCKED`: incomplete because a named dependency or approval is missing.
- `HISTORICAL`: retained as dated evidence; contains no executable next action.
- `SUPERSEDED`: replaced by another named source; contains no executable next action.

## Canonical documents

| Path | Status on this branch | Authority | Notes |
|---|---|---|---|
| `AGENT_CONSTITUTION.md` | DRAFT | GOVERNANCE | Candidate constitution for later review and merge. |
| `PROJECT_HANDOFF.md` | DRAFT | OPERATIONAL | Must describe current repository state and the next governance-only action. |
| `docs/governance/DOCUMENT_REGISTRY.md` | DRAFT | GOVERNANCE | Canonical classification index. |
| `docs/governance/GOV_A_READINESS_REPORT.md` | DRAFT | EVIDENCE | Readiness evidence for governance stage GOV-A. |

## Historical-source rule

Repository history before base commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f` remains immutable evidence. Any older Handoff or stage document that conflicts with the canonical sources above must be classified `HISTORICAL` or `SUPERSEDED` before merge. It must not retain an executable `NEXT_REQUIRED_ACTION`.

## Pending inventory

A complete Markdown inventory has not been mechanically generated because this governance task forbids running repository scripts. Before GOV-A can be declared complete, a reviewer must confirm every operational/governance Markdown document is listed and classified without executing code.