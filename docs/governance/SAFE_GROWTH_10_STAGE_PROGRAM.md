# Safe Growth Ten-Stage Program

Document status: CURRENT
Authority: STRATEGIC OPERATING PROGRAM
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

## Program decision

`SAFE-GROWTH-10-STAGE-PROGRAM: APPROVED — SEQUENTIAL EXECUTION ONLY`

The program is executed one stage at a time. A stage must be completed, documented, independently reviewed and returned to fail-closed before the next stage may begin. No stage starts automatically.

## Program roles

- Owner / Operator: `AYMAN`
- Independent approver: `pixelreel2026`
- Repository: `aymanmahrous/command-center-hub`
- Branch: `agent/phase-a-source-of-truth`

A later stage may require additional Security, Release, Privacy, Database, Content or Provider approval. Missing approval fails closed.

## Permanent program prohibitions

The following are prohibited throughout all ten stages unless a later, separate governance amendment explicitly replaces this rule:

- image generation;
- video generation;
- paid AI provider use;
- automatic provider spend;
- unapproved trials that can convert to paid usage;
- automatic fallback to a paid model or provider;
- hidden media rendering, transcription, enhancement or generation charges;
- Production writes without an operation-specific gate;
- Supabase, Storage, publishing, scheduling, webhook, CRM or Booking writes without a separately approved stage operation;
- execution outside an exact target SHA and named repository branch.

Default AI cost ceiling: `0`.
Default media-generation ceiling: `0` images and `0` videos.

## Universal stage contract

Every stage must define and record:

1. exact scope and excluded scope;
2. exact repository, branch and target SHA;
3. Owner / Operator and Independent approver;
4. required checks and evidence;
5. allowed Environment and secret scope;
6. kill switch and named owner;
7. rollback / recovery plan;
8. audit receipt location;
9. idempotency identity;
10. concurrency lock identity;
11. maximum duration and expiry;
12. PASS and FAIL conditions;
13. explicit stop before the next stage.

Any missing, ambiguous, expired, skipped or unverified control causes `FAIL-CLOSED`.

## Stages

### 1. SAFE EXECUTION BASELINE

Establish the immutable safety contract, role separation, cost/media prohibition, approved dispatch boundary, receipts, rollback, kill switch, idempotency and concurrency rules. No provider or runtime execution.

### 2. READ-ONLY INVENTORY

Inventory public website, SEO, Local SEO, Google Business/Maps, social accounts, YouTube, TikTok, Meta, n8n architecture, chatbot interfaces, CRM/Booking entry points and permission gaps without adding credentials or changing remote state.

### 3. CONVERSION OPERATING MODEL

Define the governed flow from interaction to validated event, deduplicated contact, Lead, qualification, Booking request and staff confirmation. No CRM or Booking writes.

### 4. CONTENT CALENDAR (DRAFT-ONLY)

Create offline text-only editorial planning, approval states, attribution and content fingerprints. No AI generation, images, video, upload, scheduling or publishing.

### 5. N8N SHADOW MODE

Design and later validate synthetic-data, no-write workflows with bounded retries, replay protection, dead-letter behavior and zero Production credentials. No live webhook or provider mutation.

### 6. CHATBOT SCRIPTED EVALUATION

Evaluate deterministic scripted conversations and handoff behavior without a paid AI provider, external tool writes, CRM writes or Booking confirmation.

### 7. SINGLE CHANNEL PILOT

A separately approved pilot for one channel only, with one operation, strict volume limit, manual approval and immediate kill switch. Images, video generation and paid AI remain prohibited.

### 8. MULTI-CHANNEL EXPANSION

Expand only after the single-channel pilot has complete PASS receipts. Each channel retains independent credentials, locks, approvals and rollback; no unsafe cross-channel fallback.

### 9. CRM & BOOKING INTEGRATION

Introduce server-mediated, idempotent, concurrency-controlled Lead and Booking-request operations after separate Database/Security approval. Staff confirmation remains required.

### 10. MONTHLY GROWTH OPERATIONS REVIEW

Review KPIs, attribution, failures, costs, permissions, receipts, content quality, local visibility and conversion. The review cannot activate a blocked operation by itself.

## Transition rule

A stage is eligible to start only after:

- the previous stage report says `COMPLETED`;
- the previous stage returned to fail-closed;
- a separate explicit instruction names the next stage;
- the next-stage Gate is complete;
- a new exact target SHA is selected.

The current authorized stage is Stage 1 only. Stage 2 remains blocked until a separate explicit instruction.