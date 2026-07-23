# Stage 04 — Content Calendar (Draft-Only)

Document status: CURRENT
Authority: STAGE COMPLETION RECEIPT AND EDITORIAL DESIGN CONTRACT
Applies to: command-center-hub
Last verified: 2026-07-24 (Asia/Dubai)

## Decision

`STAGE-04-CONTENT-CALENDAR-DRAFT-ONLY: COMPLETED — STOPPED BEFORE STAGE 05`

## Authorization

- Target SHA: `8436ce429bb001a0a22a973405b462e4460a1397`
- Owner / Operator: `AYMAN`
- Independent approver: `pixelreel2026`
- Allowed Environment: `DESIGN-ONLY / REPOSITORY-READ-ONLY`
- FREE-SAFE-MODE: `ACTIVE`
- External provider API calls: `0`
- Workflow executions: `0`
- n8n executions: `0`
- CRM writes: `0`
- Booking writes: `0`
- Publishing: `0`
- Scheduling: `0`
- Webhooks: `0`
- Paid AI calls: `0`
- Generated images: `0`
- Generated videos: `0`

## Stage boundary

This document is a text-only editorial plan. It does not create final copy, images, video, audio, thumbnails, uploads, posts, schedules, campaigns, provider drafts or runtime jobs. Every calendar item remains `DRAFT_ONLY / NOT APPROVED FOR PUBLISHING`.

## Editorial objectives

### Awareness

Help Abu Dhabi audiences recognize relevant swimming-learning needs, understand service categories and discover accurate local information without exaggerated claims.

### Trust

Explain the coaching process, safety boundaries, assessment flow, locations, audience fit and staff-confirmation model using factual, reviewable text.

### Conversion

Guide a qualified interaction toward one clear next step: request information, request an assessment, contact staff or submit a Booking Request. A CTA never confirms availability or a booking.

## Channel roles

- Website: durable factual service, location, FAQ and conversion-path content.
- Google Business: future short factual updates and service/location clarification; no live post is authorized.
- Meta: future text-led awareness, trust and response prompts; no account access or publishing.
- TikTok: text-only concept and script-outline labels; no video production or upload.
- YouTube: text-only title, description and script-outline labels; no recording, video or upload.
- Chatbot: approved text prompts and deterministic handoff topics; no runtime.
- Command Center: governance view for status, owner, approval, fingerprint, attribution and exceptions only.

## Content item contract

Every draft item must define:

- `content_id`;
- `content_type`: awareness, trust or conversion;
- `audience`;
- `language`: ar, en or bilingual;
- `service_interest`;
- `location_interest` when applicable;
- `channel_targets`;
- `objective`;
- `core_message_summary`;
- `theoretical_cta`;
- `conversion_stage` from Stage 03;
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` where applicable;
- `content_fingerprint` design input;
- `owner`;
- `independent_approver`;
- `status: draft_only`;
- `media_required: false`;
- `publish_authorized: false`.

## Theoretical CTA library

- `learn_more`: read an approved service or FAQ page.
- `view_locations`: review approved public training-location information.
- `request_information`: ask staff for factual details.
- `request_assessment`: submit an assessment request, not a confirmed appointment.
- `contact_staff`: use an approved human-handoff route.
- `start_booking_request`: begin a Booking Request that still requires validation and staff confirmation.

Prohibited CTA claims include instant confirmation, guaranteed availability, guaranteed outcomes, urgency without evidence, free/discount claims without approval and any medical or therapeutic promise.

## Stage 03 conversion mapping

- Awareness drafts target `Interaction` and a valid information event.
- Trust drafts target `Validated Event`, consent-aware follow-up and qualified interest.
- Conversion drafts target `Lead` or `Booking Request` candidates only.
- No draft may represent `Staff Confirmation` as automatic.
- Any sensitive, unclear, complaint or booking-confirmation request routes to human handoff.

## UTM and attribution design

Example naming convention only:

- `utm_source`: website, google_business, meta, tiktok, youtube or chatbot;
- `utm_medium`: organic, profile, social, video_concept, chatbot or referral;
- `utm_campaign`: `abu_dhabi_swim_education_YYYY_MM`;
- `utm_content`: stable `content_id` plus language and channel variant;
- `utm_term`: optional approved search-intent label.

Missing attribution must remain unknown; it must not be fabricated. First-touch and last-touch remain separate as defined in Stage 03.

## Content fingerprint design

The theoretical fingerprint input is:

`schema_version + content_id + language + content_type + objective + core_message_summary + theoretical_cta + channel_targets + service_interest + location_interest + utm_campaign + revision`

A material change to claims, CTA, audience, channel, location, service, language or attribution creates a new revision and fingerprint. Fingerprints are design identifiers only; none were computed or written to a runtime system.

## Weekly cadence

Default planning cadence, not a publishing schedule:

- Monday: Awareness draft.
- Wednesday: Trust draft.
- Friday: Conversion draft.
- Optional Sunday: factual FAQ or location clarification draft after owner review.

Maximum design volume: three core drafts per week plus one optional factual draft. This is an editorial planning limit, not authorization to produce or publish content.

## Four-week draft calendar

| Week | Content ID | Type | Text-only draft topic | Primary channels | Objective | Theoretical CTA | Conversion mapping |
|---|---|---|---|---|---|---|---|
| 1 | `S04-W1-A1` | Awareness | How to choose an appropriate swimming-learning path in Abu Dhabi | Website, Meta, Google Business | Clarify needs and service fit | `learn_more` | Interaction |
| 1 | `S04-W1-T1` | Trust | What happens during an initial assessment request and what it does not guarantee | Website, Chatbot, Meta | Set accurate expectations | `request_information` | Validated Event |
| 1 | `S04-W1-C1` | Conversion | Steps to submit a Booking Request with staff confirmation required | Website, Chatbot | Create a valid request | `start_booking_request` | Booking Request candidate |
| 2 | `S04-W2-A1` | Awareness | Approved Abu Dhabi training-location overview without invented proximity claims | Website, Google Business | Improve local discovery | `view_locations` | Interaction |
| 2 | `S04-W2-T1` | Trust | Small-group coaching boundaries, participant fit and questions to ask staff | Website, Meta | Build informed trust | `contact_staff` | Qualified interest |
| 2 | `S04-W2-C1` | Conversion | Request information for children, adults or ladies before selecting a path | Website, Chatbot, Meta | Route to correct service interest | `request_information` | Lead candidate |
| 3 | `S04-W3-A1` | Awareness | Common beginner concerns and when human guidance is needed | Website, Meta, TikTok concept | Normalize questions safely | `learn_more` | Interaction |
| 3 | `S04-W3-T1` | Trust | How consent, minimum data and privacy apply to initial enquiries | Website, Chatbot | Build privacy confidence | `contact_staff` | Validated Event |
| 3 | `S04-W3-C1` | Conversion | How to request an assessment window without implying confirmed availability | Website, Chatbot | Create a compliant request | `request_assessment` | Booking Request candidate |
| 4 | `S04-W4-A1` | Awareness | Arabic/English FAQ themes for local swimming-learning searches | Website, YouTube concept, Meta | Support search intent | `learn_more` | Interaction |
| 4 | `S04-W4-T1` | Trust | Staff confirmation, conflict checking and why a request is not a booking | Website, Chatbot, Google Business | Prevent misunderstanding | `request_information` | Staff-review preparation |
| 4 | `S04-W4-C1` | Conversion | Choose service and location interest, then hand off to staff | Website, Chatbot, Meta | Improve qualified handoff | `contact_staff` | Lead to Booking Request |

## Monthly planning cycle

1. Inventory approved factual inputs from governance documents only.
2. Select three weekly objectives across Awareness, Trust and Conversion.
3. Assign content IDs and channel variants.
4. Draft message summaries, not publishable final copy.
5. Map CTA, conversion stage and theoretical UTM fields.
6. Review factual claims, privacy, local representation and duplication risk.
7. Record owner and independent-approver decisions.
8. Keep all items `draft_only` until a later channel-specific Gate exists.
9. Archive rejected concepts with reasons; do not silently reuse them.
10. Conduct a monthly design review without activating publishing.

## Approval states

`idea -> draft_only -> factual_review -> owner_review -> independent_review -> approved_design | rejected | needs_revision`

`approved_design` means the concept structure is approved only. It does not authorize copy production, media creation, upload, scheduling or publishing.

## Quality and claims controls

- use only approved services, locations, contact routes and public claims;
- no fabricated reviews, ratings, credentials, outcomes, availability or prices;
- no duplicate location pages or near-identical location drafts;
- no medical, therapy, rehabilitation or guaranteed-result claims;
- maintain Arabic/English factual parity;
- identify the intended audience without discriminatory or unsafe targeting;
- require human review for complaints, safety, privacy and child-related wording;
- preserve source references for factual statements in future drafts.

## Pseudo-flow for later stages

`Approved factual source -> Draft concept -> Claim review -> CTA mapping -> Attribution mapping -> Fingerprint/revision -> Owner review -> Independent review -> Approved design receipt -> STOP`

No node in this Stage 04 pseudo-flow uploads, schedules, publishes, sends, creates a Lead or executes n8n. Stage 05 owns any separately authorized n8n shadow design/execution.

## Idempotency and concurrency design

- content identity: `program + month + content_id + language + revision`;
- channel variant identity: `content_id + channel + language + revision`;
- one active editorial revision per content/channel/language tuple;
- duplicate IDs or fingerprints fail review;
- retries return the prior design receipt rather than creating a duplicate item;
- only one monthly design review may be active per repository and month.

## Kill switch and rollback

- Kill switch owner: `AYMAN`;
- kill action: stop editorial documentation changes and retain every item as `draft_only`;
- rollback: create a new auditable branch commit restoring the prior governance state;
- no provider or remote-state rollback exists because no runtime state changed.

## Audit receipt

- external API/provider calls: `0`;
- Workflow executions: `0`;
- n8n executions: `0`;
- CRM writes: `0`;
- Booking writes: `0`;
- publishing actions: `0`;
- scheduling actions: `0`;
- webhooks: `0`;
- paid AI calls: `0`;
- generated images: `0`;
- generated videos: `0`;
- real media used: `0`;
- final publishable content created: `0`;
- Production/Supabase/Storage connections: `0`;
- `main` modifications: `0`.

## Final state

`FAIL-CLOSED / NOT AUTHORIZED FOR STAGE 05`

Stage 05 `N8N SHADOW MODE` requires a separate explicit instruction, a new exact target SHA and its own completed Gate.