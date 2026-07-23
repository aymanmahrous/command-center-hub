# AI Environment Foundation

Document status: CURRENT-DESIGN
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

## Activation state

`BLOCKED — DESIGN ONLY`

No AI Environment, provider credential, model call, generation, spend, or database write is authorized by GOV-G.

## Model allowlist

- Empty by default.
- A model may be added only by exact provider and exact model identifier.
- No fallback, auto-routing, preview/beta model, image, audio, video, agentic browsing, tool execution, or fine-tuning endpoint is allowed unless separately approved.
- The first safe-execution candidate is text-only and must remain non-publishing.

## Token and cost ceilings

- Token ceiling: deny by default until a numeric per-request and per-run ceiling is approved.
- Cost ceiling: zero until a numeric per-run and daily ceiling is approved.
- The system must fail closed before a provider call when either ceiling is absent or exceeded.

## Required approvals

- AI Operations Owner.
- Independent AI Risk Approver who is not the author/operator.
- Repository Owner for target SHA and scope.
- Separate Security approval for any secret or environment change.

## Required controls

- dedicated `production-ai-spend` or disposable AI environment; never browser credentials;
- exact target SHA and approved registered operation;
- idempotency key and immutable run ID;
- per-scope concurrency lock;
- model allowlist enforcement before request;
- input/output size limits and sensitive-data rejection;
- provider timeout and bounded retries that reuse the same idempotency identity;
- no Storage write, publishing, scheduling, outbound message, Migration, or Production database write.

## Kill switch

Owner: AI Operations Owner.

Stop method: disable the dedicated environment approval, revoke/disable the scoped provider credential, set the feature gate to disabled, and reject new/queued calls.

After stop: preserve run IDs, provider receipts, input/output hashes, cost records and unresolved provider-job status; do not publish or delete evidence silently.

## Rollback

AI output is treated as an unapproved draft. Rollback means disabling new calls, marking the run failed/cancelled through an approved auditable path, and quarantining/removing any draft only with preserved hashes and approval. External provider jobs must be reconciled before correction.

## Audit receipt

Required fields: repository, target SHA, environment, operation ID, actor, approver, model identifier, token ceilings, estimated/actual tokens, cost ceiling, actual cost, idempotency key, lock key, run ID, timestamps, input/output hashes, provider request ID, result, kill-switch state and unresolved side effects.
