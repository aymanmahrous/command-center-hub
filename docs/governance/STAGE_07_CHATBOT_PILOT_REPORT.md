# Stage 07 — Chatbot Pilot Report

Document status: CURRENT
Authority: STAGE EXECUTION ATTEMPT RECEIPT AND PILOT DESIGN CONTRACT
Applies to: command-center-hub
Last verified: 2026-07-24 (Asia/Dubai)

## Decision

`STAGE-07-SINGLE-CHANNEL-PILOT (MULTI-SURFACE EXTENSION): BLOCKED — LIVE PILOT NOT AUTHORIZED`

`DESIGN PACKAGE: COMPLETED — NO CHANNEL ACTIVATED`

`FAIL-CLOSED / NOT AUTHORIZED FOR STAGE 08`

## Authorization

- Target SHA: `63504f919a2937df94ea2a9655b80299907e24ec`
- Owner / Operator: `AYMAN`
- Independent approver: `pixelreel2026`
- Requested Environment: `WEBSITE + FACEBOOK + INSTAGRAM + WHATSAPP ONLY`
- FREE-SAFE-MODE: `ACTIVE`
- External API calls ceiling: `0`
- CRM writes ceiling: `0`
- Booking writes ceiling: `0`
- Publishing / Scheduling ceiling: `0`
- Webhooks ceiling: `0`
- Paid AI calls ceiling: `0`
- Generated images ceiling: `0`
- Generated videos ceiling: `0`
- User-message storage or transmission ceiling: `0`

## Gate conflict

The requested scope is not a single-channel pilot. It contains four surfaces: website, Facebook Page Inbox, Instagram DM and WhatsApp Business Auto-Replies.

Facebook, Instagram and WhatsApp reply activation requires remote account configuration or message handling. That cannot be represented as completed while external calls, webhooks, publishing, message transmission and account connections are all prohibited.

Therefore this stage may define scripts, channel boundaries, review controls and a future rollout sequence, but it may not activate or test a live surface.

## Design-only pilot model

### Surface order for later separately gated execution

1. Website scripted interface only.
2. Facebook Page Inbox saved replies or automated replies.
3. Instagram DM quick replies.
4. WhatsApp Business approved scripted auto-replies.

Each surface must receive an independent Gate, credential boundary, kill switch, receipt and rollback. No simultaneous activation is permitted under the current Single Channel stage definition.

## Approved scripted intent families

- services;
- prices, only from approved current facts;
- approved locations;
- schedules and availability with staff-confirmation language;
- children;
- adults;
- ladies;
- Booking Request, never confirmed booking;
- contact and human handoff.

## Global reply rules

- use approved repository facts only;
- never invent price, availability, location, review, credential or outcome;
- never confirm a booking automatically;
- never claim that a staff transfer occurred unless a later real channel action proves it;
- collect no user message, PII or conversation content in this stage;
- route complaints, safety, privacy, uncertainty and booking confirmation to staff conceptually;
- preserve Arabic/English factual parity;
- prohibit medical, therapeutic, rehabilitation or guaranteed-result claims.

## Surface-specific design

### Website

A future pilot may expose deterministic scripted replies inside the website only after a separate runtime Gate. Current status: documentation only; no chatbot runtime or preview executed.

### Facebook Page Inbox

Draft reply categories may be prepared for services, prices, locations, schedules and staff handoff. No Page account was accessed and no Auto-Reply was created or enabled.

### Instagram DM

Quick Reply labels and text templates may be prepared. No Instagram account was accessed and no Quick Reply was created or enabled.

### WhatsApp Business

Scripted Auto-Reply patterns may be prepared for greeting, service routing, availability disclaimer and staff handoff. No WhatsApp account, API, device session or message was accessed, transmitted or stored.

## Conceptual reply state model

`message_category -> approved_script -> factual_response | bounded_clarification | human_handoff_notice -> STOP`

Prohibited states:

`message_received_from_provider`, `conversation_stored`, `external_reply_sent`, `lead_created`, `calendar_checked`, `booking_confirmed`, `webhook_emitted`.

## Draft-only social calendar

This is editorial planning only for Facebook and Instagram:

- Monday: Awareness concept;
- Wednesday: Trust concept;
- Friday: Conversion concept;
- Sunday: FAQ / clarification concept.

All items remain text-only `draft_only`. No post copy was uploaded, scheduled or published. No image, video, audio, thumbnail or real media was used.

## Conversion mapping

- factual question -> `Interaction`;
- acceptable structured request -> `Validated Event candidate`;
- qualified request -> `Lead candidate`;
- service/location/time preference -> `Booking Request candidate`;
- staff action under a later Gate -> `Staff Confirmation`.

No surface may skip directly to confirmed booking.

## Future independent pilot requirements

Before any one surface can run:

- select exactly one surface;
- approve a new exact Target SHA;
- identify the account/runtime and owner;
- define allowed message fields and retention as zero or explicitly approved;
- establish credential isolation;
- establish channel-specific kill switch;
- define maximum message/test volume;
- obtain Privacy and Security approval;
- define immutable receipts;
- prove no paid fallback or media generation;
- authorize the external account operation explicitly.

## Kill switch and rollback

- Kill switch owner: `AYMAN`.
- Current kill action: do not activate any surface or remote reply configuration.
- Future channel kill action: disable only the selected surface and preserve unrelated channels.
- Rollback for this stage: a new auditable branch commit restoring prior governance text.
- No remote rollback is required because no account or runtime state changed.

## Audit receipt

- website chatbot runtime executions: `0`;
- Facebook account connections/replies: `0`;
- Instagram account connections/replies: `0`;
- WhatsApp account connections/messages: `0`;
- external API calls: `0`;
- user messages stored: `0`;
- user messages transmitted by this stage: `0`;
- CRM writes: `0`;
- Booking writes: `0`;
- publishing actions: `0`;
- scheduling actions: `0`;
- webhooks: `0`;
- paid AI calls: `0`;
- generated images: `0`;
- generated videos: `0`;
- Production / Supabase / Storage connections: `0`;
- `main` modifications: `0`.

## Preserved dependencies

Stage 05 remains `BLOCKED — NO AUTHORIZED SHADOW RUNNER`. Stage 06 remains documentation-only completed. Neither status authorizes live channel operation.

## Final state

Stage 07 live pilot is not complete. The design package is complete and all channels remain inactive.

`FAIL-CLOSED / NOT AUTHORIZED FOR STAGE 08`

A retry must choose exactly one channel and provide a new operation-specific Gate. Multi-surface activation belongs to Stage 08 only after a genuine single-channel PASS receipt.