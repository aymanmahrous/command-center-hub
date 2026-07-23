# Unified Phase Namespace

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub and swim-fluent-uae
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner

## Governance program

- `GOV-A` — Source of truth
- `GOV-B` — Pull-request organization
- `GOV-C` — Registry and ownership
- `GOV-D` — GitHub enforcement design
- `GOV-E` — CI normalization
- `GOV-F` — Risk reduction and hardening
- `GOV-G` — Safe preparation for Phase 3
- `GOV-H` — Final executive decision

## Canonical Phase 3 identifier

`PHASE-3-SAFE-EXECUTION`

This is the only authoritative meaning of “Phase 3”. Bare `Phase 3`, numeric-only phase names, and prior conflicting meanings are non-authoritative.

`PHASE-3-SAFE-EXECUTION` means a separately authorized, limited execution window that must satisfy all of the following:

- limited scope and duration;
- no Production write;
- no uncontrolled AI or model outside the approved allowlist;
- no publishing, scheduling, outbound messaging, Ads, billing, or spend outside the approved ceiling;
- no Storage write;
- no Migration, DDL, RLS, grant, policy, cron, worker, or schema change;
- no operation absent from `WRITE_AND_WORKFLOW_REGISTRY.md`;
- no browser-held protected credential or direct table write;
- explicit target SHA, environment, owner, independent approver, idempotency key, concurrency control, audit receipt, kill switch, and rollback plan;
- fail closed when any required control is missing.

GOV-G prepares these controls only. It does not authorize `PHASE-3-SAFE-EXECUTION` to begin.

## Product work

Product work must use descriptive identifiers, including:

- `PRODUCT-SEO-READINESS`
- `PRODUCT-CONTENT-BRAIN-VALIDATION`
- `PRODUCT-CRM-CONTROLLED-WRITES`

A feature PR must not contain a Migration. A Migration must be an isolated database PR with its own approval, disposable verification plan, audit evidence, and rollback/forward-fix plan.
