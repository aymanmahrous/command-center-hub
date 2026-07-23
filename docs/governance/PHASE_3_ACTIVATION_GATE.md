# Phase 3 Activation Gate

Document status: CURRENT
Authority: EXECUTION GATE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

`PHASE-3-SAFE-EXECUTION` does not start automatically. A separate explicit order is mandatory after GOV-H. Any missing, ambiguous, expired or unverified item below causes `FAIL-CLOSED`.

## Required target

- exact 40-character commit SHA;
- repository and branch named explicitly;
- operation name exactly matching `WRITE_AND_WORKFLOW_REGISTRY.md`;
- fixed scope, maximum duration and expiry time;
- no mutable tag, broad branch range or implicit latest version.

## Required approvals

- Repository Owner;
- operation Responsible/Operator;
- Independent approver who is not author or operator;
- Security approval for any Environment or credential scope;
- domain approval when applicable, including Database, AI, Privacy, Content or Release.

Named people and verified repository access are required. Role placeholders alone do not pass.

## Required checks

The exact target SHA must have successful observed contexts applicable to its scope:

- `verify:source`;
- `verify:ci`;
- `verify:release`;
- `test:unit`;
- `test:security`;
- `test:contracts`;
- `test:e2e:preview` when Preview is involved.

`test:integration:disposable` is not applicable unless a separately authorized database-only PR creates a legitimate disposable path. Historical or skipped checks do not pass.

## Required environment

- source-only or `preview-readonly` for the first candidate;
- exact allowlisted URL when network reading is required;
- no Production write credential;
- no database service role, AI key, Storage-write token, publishing token or webhook secret;
- protected approval and no self-approval;
- environment expiry/disable procedure recorded.

## Kill switch

Before start, record the named kill-switch owner and an immediately executable stop method: disable approval, revoke scoped credential, disable feature/route, cancel the run, or block further requests. The stop must preserve receipts and fail closed.

## Rollback

Record rollback owner, before-state, compensating action, verification method and evidence location. Git rollback uses a new commit; history rewriting is prohibited. Database, AI, Storage and publishing rollback plans do not make those operations eligible under this gate.

## Audit receipt

Required fields:

- repository, branch and target SHA;
- operation and Registry row;
- requester, operator and independent approver;
- environment and host;
- start, expiry and completion times;
- check contexts and URLs/IDs;
- idempotency key and concurrency-lock identity where applicable;
- inputs and output hashes;
- run/request IDs;
- kill-switch readiness and any activation;
- rollback result;
- final PASS/FAIL and unresolved side effects.

No secret values may appear in the receipt.

## PASS conditions

PASS requires every field above, an operation that is read-only or explicitly allowed by the safe-execution contract, no prohibited credential, successful checks on the exact SHA, verified independent approval, ready kill switch, tested-in-design rollback and a time-bounded separate authorization.

## FAIL conditions

FAIL includes any missing control; Production write; Migration; AI without an approved allowlist and ceilings; Storage write; publishing; messaging; browser protected credential; unregistered action; failed/skipped/stale check; mismatched SHA; self-approval; non-allowlisted host; ambiguous rollback; or expired authorization.

A FAIL decision permits no partial execution and no automatic retry.