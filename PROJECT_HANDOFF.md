# Command Center Hub Project Handoff

Document status: CURRENT
Authority: OPERATIONAL
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner

## Current stage

`PHASE-3-DISPATCH-SETUP: COMPLETED — READY FOR EXECUTION`

`GROWTH-OPERATING-FOUNDATION: APPROVED — EXECUTION GATED`

The dispatch mechanism is prepared but no Check or Workflow was run. The omnichannel growth plan is now the strategic operating basis, but it does not activate any provider, account, automation, write or publishing path.

## Approved strategic foundation

The authoritative plan is `docs/governance/GROWTH_OPERATING_FOUNDATION.md`, with approval evidence in `docs/governance/GROWTH_OPERATING_FOUNDATION_APPROVAL_REPORT.md`.

It governs:

1. Google Business;
2. Google Maps;
3. SEO;
4. Local SEO;
5. Meta — Facebook and Instagram;
6. TikTok;
7. YouTube;
8. n8n;
9. Chatbot;
10. Scheduling and Publishing.

The objectives are qualified search growth, Abu Dhabi local visibility, Google Maps/Business improvement, controlled automation, traceable Lead/Booking conversion and safe multi-channel operation without destructive coupling.

## Repository role

`command-center-hub` is the governance and control plane. It may expose read-only channel health, approvals, audit receipts, queue state and exceptions. It may not hold browser provider secrets, write directly to providers or bypass server-enforced operations.

## First permitted strategic work

Only separately authorized source-only or read-only work may be considered first:

- technical SEO and source audit;
- public-site read-only verification;
- Google Business/Maps ownership and discrepancy inventory;
- NAP, citation and Local SEO gap inventory;
- channel/account/permission inventory without credentials being added;
- n8n architecture and workflow registry design;
- chatbot scripted/non-provider evaluation;
- offline editorial calendar and approval-state design.

## Still frozen

- provider account connections and credentials;
- Google Business/Maps mutations;
- n8n execution and webhooks;
- AI generation or AI-powered chatbot tools;
- CRM and Booking writes;
- social/video upload, replies, scheduling and publishing;
- Production database, Supabase, Storage and Migrations;
- bulk content/location generation or automatic cross-channel publishing;
- repository settings, secrets and PR metadata changes without separate authority.

PR #8 remains stale and non-merge-ready.

## Authorized source-only dispatch

`.github/workflows/phase-3-source-only-dispatch.yml` defines manual `workflow_dispatch` for `source-only-verification` only. It requires an exact 40-character SHA equal to the selected governance-branch commit, uses `contents: read`, disables persisted checkout credentials, references no secret or Environment and exposes only:

- `verify:source`;
- `verify:ci`;
- `verify:release`;
- `test:unit`;
- `test:security`;
- `test:contracts`.

Concurrency is limited to one run per target SHA. Cancellation is the kill switch.

## Activation rule

Strategic approval is not execution approval. Every channel and operation must receive its own exact scope, target SHA, named operator, independent approver, credential boundary, checks, idempotency, concurrency lock, kill switch, rollback and audit receipt. Missing controls fail closed.

Do not start `PHASE-3-SAFE-EXECUTION`, connect a provider, create a webhook, write a Lead/Booking, run n8n or publish automatically without a separate explicit instruction and a complete activation gate.
