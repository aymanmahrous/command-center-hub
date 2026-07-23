# Phase 3 Activation Gate

Document status: CURRENT
Authority: EXECUTION GATE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

`PHASE-3-SAFE-EXECUTION` does not start automatically. A separate explicit order is mandatory after PHASE-3-DISPATCH-SETUP. Any missing, ambiguous, expired or unverified item causes `FAIL-CLOSED`.

## Eligible registered operations

Only these literal Registry operations are eligible:

1. `source-only-verification`
2. `preview-readonly-verification`

`ALLOWED-FOR-PHASE-3` is eligibility only, not execution authorization.

## Authorized dispatch mechanism

For `source-only-verification`, the authorized repository definition is:

`.github/workflows/phase-3-source-only-dispatch.yml`

Controls:

- manual `workflow_dispatch` only;
- exact lowercase 40-character `target_sha` input;
- dispatch ref must be `agent/phase-a-source-of-truth`;
- input SHA must equal the selected branch commit;
- `permissions: contents: read` only;
- checkout uses `persist-credentials: false`;
- no Environment and no secret reference;
- one concurrency group per target SHA;
- only the six registered source checks are exposed.

The definition does not authorize automatic dispatch. If GitHub cannot dispatch the branch definition, an independently approved isolated runner using the exact same commands is required; otherwise fail closed.

## Required target

- exact 40-character commit SHA;
- repository and branch named explicitly;
- one eligible operation;
- fixed scope, duration and expiry;
- no mutable or implicit target.

## Required approvals

- Repository Owner;
- named Operator;
- named Independent approver who is not author or operator;
- Security approval for Environment or credential scope;
- Release approval for Preview.

## Required checks

For `source-only-verification`, all must succeed on the exact target SHA:

- `verify:source`;
- `verify:ci`;
- `verify:release`;
- `test:unit`;
- `test:security`;
- `test:contracts`.

For `preview-readonly-verification`, all source checks plus `test:e2e:preview` must succeed.

## Required environment

- source-only: GitHub Actions or approved isolated runner with repository read scope only;
- Preview: `preview-readonly` and exact approved HTTPS URL;
- no Production, database, Supabase, AI, Storage-write, publishing, webhook or messaging credential;
- no remote mutation.

## Kill switch and rollback

Cancel the run and disable further dispatch. Preserve receipts and return to fail closed. No remote state change is permitted; Git rollback uses a new auditable branch commit.

## Audit receipt

Record repository, branch, target SHA, operation, requester, operator, independent approver, dispatch mechanism, run ID, timestamps, check contexts, configuration hash, concurrency identity, kill-switch state, final PASS/FAIL and unresolved effects. Never record secret values.

## PASS / FAIL

PASS requires every applicable control, successful exact-SHA checks, independent approval and verified read-only scope. Any unavailable dispatch, stale or missing check, mismatched SHA, prohibited credential or action causes FAIL-CLOSED with no partial execution or automatic retry.
