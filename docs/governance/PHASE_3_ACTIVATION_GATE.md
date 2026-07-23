# Phase 3 Activation Gate

Document status: CURRENT
Authority: EXECUTION GATE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

`PHASE-3-SAFE-EXECUTION` does not start automatically. A separate explicit order is mandatory after PHASE-3-PREP. Any missing, ambiguous, expired or unverified item causes `FAIL-CLOSED`.

## Eligible registered operations

Only these literal Registry operations are eligible for the first safe-execution attempt:

1. `source-only-verification`
2. `preview-readonly-verification`

Their full controls, approvals, secrets scope, kill switch, rollback, audit receipt, idempotency and concurrency requirements are authoritative in `WRITE_AND_WORKFLOW_REGISTRY.md`. `ALLOWED-FOR-PHASE-3` is eligibility only, not execution authorization.

## Required target

- exact 40-character commit SHA;
- repository and branch named explicitly;
- one operation name exactly matching the eligible names above;
- fixed scope, maximum duration and expiry time;
- no mutable tag, broad branch range or implicit latest version.

## Required approvals

- Repository Owner;
- named Responsible/Operator;
- named Independent approver who is not author or operator;
- Security approval for any Environment or credential scope;
- Release approval for Preview URL and environment evidence.

Named people and verified repository access are required. Role placeholders alone do not pass.

## Required checks

For `source-only-verification`, the exact target SHA must show successful observed contexts:

- `verify:source`;
- `verify:ci`;
- `verify:release`;
- `test:unit`;
- `test:security`;
- `test:contracts`.

For `preview-readonly-verification`, all source-only checks above plus `test:e2e:preview` must succeed on the exact SHA. Historical, skipped, stale or mismatched checks fail.

## Required environment

- `source-only-verification`: isolated runner or GitHub Actions with repository read scope only;
- `preview-readonly-verification`: `preview-readonly` and one exact approved HTTPS Preview URL;
- no Production write credential;
- no database service role, AI key, Storage-write token, publishing token, webhook secret or messaging credential;
- protected approval, no self-approval, and expiry/disable procedure recorded.

## Kill switch

Use the operation-specific method in the Registry. At minimum: cancel the run, disable dispatch/runner or Environment approval, revoke any narrowly scoped read token, preserve receipts and return to fail closed.

## Rollback

No remote state change is permitted. Stop the run and discard transient local/browser state where allowed. Git rollback uses a new auditable branch commit; history rewriting is prohibited.

## Audit receipt

Record repository, branch, target SHA, literal Registry operation, requester, operator, independent approver, Environment, exact URL when applicable, start/expiry/completion, check contexts and run IDs, configuration/input hashes, idempotency identity, concurrency identity, kill-switch readiness/activation, rollback result, final PASS/FAIL and unresolved effects. Never record secret values.

## PASS conditions

PASS requires every applicable field above, the exact Registry row with status `ALLOWED-FOR-PHASE-3`, successful checks on the exact SHA, named independent approval, verified read-only secrets scope, approved URL for Preview, ready kill switch, rollback readiness and a separate time-bounded execution order.

## FAIL conditions

FAIL includes any missing control; operation name mismatch; unavailable dispatch/runner; missing Preview URL; Production write; Migration; AI; Storage write; publishing; scheduling; messaging; protected browser credential; failed/skipped/stale check; mismatched SHA; self-approval; non-approved host; ambiguous rollback; or expired authorization.

A FAIL decision permits no partial execution, fallback or automatic retry.
