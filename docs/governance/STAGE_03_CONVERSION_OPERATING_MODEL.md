# Stage 03 — Conversion Operating Model

Document status: CURRENT
Authority: STAGE COMPLETION RECEIPT AND DESIGN CONTRACT
Applies to: command-center-hub
Last verified: 2026-07-24 (Asia/Dubai)

## Decision

`STAGE-03-CONVERSION-OPERATING-MODEL: COMPLETED — STOPPED BEFORE STAGE 04`

## Authorization

- Target SHA: `7b554984062fc860d047d54a226e12dc9527acaa`
- Owner / Operator: `AYMAN`
- Independent approver: `pixelreel2026`
- Allowed Environment: `DESIGN-ONLY / REPOSITORY-READ-ONLY`
- FREE-SAFE-MODE: `ACTIVE`
- Paid AI cost ceiling: `0`
- Generated images ceiling: `0`
- Generated videos ceiling: `0`

## Scope

This stage converts the Stage 02 inventory into a repository-only operating design. It does not open accounts, collect new Insights, run tools, execute workflows, call APIs, write CRM or Booking data, publish, schedule or create webhooks.

## Governed conversion path

`Interaction -> Validated Event -> Deduplicated Contact -> Lead -> Qualification -> Booking Request -> Staff Confirmation`

No step after Interaction is automatic authority to create a confirmed booking.

## Interaction sources

The model recognizes these theoretical source families:

- website forms and approved conversion links;
- deterministic chatbot text interactions;
- WhatsApp/call/email handoff requests;
- Google Business and Maps interactions;
- Meta, TikTok and YouTube interactions;
- organic search and Local SEO landing routes;
- approved campaign links using UTM attribution;
- future n8n shadow events using synthetic data only.

Each source must map to one canonical `source_channel`, `source_surface` and `source_reference` before later implementation.

## Validated event schema

Required design fields:

- `event_id` — immutable unique identifier;
- `event_type` — interaction, lead_request, booking_request or handoff;
- `occurred_at` — ISO timestamp in Asia/Dubai context;
- `source_channel`;
- `source_surface`;
- `source_reference`;
- `language` — ar or en;
- `service_interest`;
- `location_interest`;
- `consent_state`;
- `payload_version`;
- `content_fingerprint` where content attribution applies;
- `idempotency_key`;
- `privacy_classification`.

Rejected events must produce a rejection reason without creating a Lead.

## Contact and Lead design

### Deduplicated contact

A contact is a normalized identity candidate, not a confirmed customer. Later implementation may use approved combinations of normalized phone, email and channel identity, subject to Privacy approval.

### Lead schema

- `lead_id`;
- `contact_id`;
- `source_event_id`;
- `source_channel`;
- `campaign_source`, `campaign_medium`, `campaign_name`, `campaign_content`, `campaign_term`;
- `language`;
- `service_interest`;
- `location_interest`;
- `lead_status`;
- `qualification_state`;
- `consent_state`;
- `assigned_owner`;
- `created_at`, `updated_at`;
- `version`;
- `idempotency_key`.

## Booking-request schema

- `booking_request_id`;
- `lead_id`;
- `requested_service`;
- `requested_location`;
- `requested_date_window`;
- `requested_time_window`;
- `participant_type` — child, adult or ladies where applicable;
- `staff_confirmation_required: true`;
- `booking_status`;
- `conflict_check_state`;
- `consent_state`;
- `created_at`, `updated_at`;
- `version`;
- `idempotency_key`.

A Booking Request is never equivalent to a confirmed appointment.

## Validation rules

- reject missing source, consent state, service interest or contact route where required;
- reject unsupported service/location identifiers;
- reject malformed or future-incompatible payload versions;
- reject prohibited sensitive data not required for the service flow;
- do not infer medical facts, guarantees, availability or prices;
- preserve original event evidence and normalized values separately;
- require staff confirmation before confirmed status;
- require explicit reason for rejection, cancellation or manual override.

## Deduplication design

Deduplication priority:

1. exact idempotency key;
2. exact source event identifier;
3. approved normalized contact key within a bounded time window;
4. same service, location and booking window with the same contact candidate;
5. manual review when confidence is ambiguous.

Automatic merging of ambiguous people is prohibited.

## Attribution and UTM mapping

Canonical fields:

- `utm_source` -> `campaign_source`;
- `utm_medium` -> `campaign_medium`;
- `utm_campaign` -> `campaign_name`;
- `utm_content` -> `campaign_content`;
- `utm_term` -> `campaign_term`;
- landing route -> `source_surface`;
- channel account/post/profile reference -> `source_reference`.

First-touch and last-touch attribution must be stored separately. Missing UTM data must not be fabricated.

## Consent and privacy boundaries

- collect only the minimum information required for follow-up;
- record consent source, wording version and timestamp;
- separate operational data from analytics attribution;
- prohibit medical, diagnostic or unnecessary child data in initial events;
- define retention before implementation;
- restrict sensitive fields by role;
- support deletion/correction requests after a later Privacy gate;
- never place secrets or private account links in browser-visible records.

## State models

### Lead states

`new -> validated -> qualified | unqualified -> contacted -> booking_requested -> converted | closed`

Permitted exception states:

`needs_review`, `duplicate_suspected`, `consent_missing`, `invalid`, `cancelled`.

### Booking-request states

`draft -> submitted -> validation_pending -> staff_review -> confirmed | rejected | expired | cancelled`

Only staff or a later separately authorized server operation may transition to `confirmed`.

## Human handoff

Handoff is mandatory when:

- user asks for a person;
- intent is unclear or low-confidence;
- complaint, safety, privacy or sensitive information appears;
- availability or policy cannot be answered from approved data;
- booking confirmation is requested;
- duplicate or consent conflict is detected.

The handoff receipt must include reason, source event, owner queue and status without exposing secret values.

## Chatbot text-only model

The deterministic chatbot may later route approved intents such as services, pricing, booking request, locations, schedules, adults, kids, ladies and contact. In Stage 03 this is documentation only. No chatbot runtime, AI provider, CRM tool or Booking tool was invoked.

## n8n pseudo-flow

`Manual/Synthetic Event -> Schema Validate -> Consent Check -> Deduplication Check -> Build Lead Candidate -> Qualification Queue -> Booking Request Candidate -> Staff Review Queue -> Receipt`

All nodes are conceptual. Stage 05 owns any n8n shadow execution. External connections, credentials, webhooks and writes remain prohibited.

## Idempotency and concurrency

- Event identity: `repository + payload_version + source_channel + source_event_id`;
- Lead identity: approved normalized contact key plus bounded source window;
- Booking-request identity: `lead_id + service + location + requested window`;
- one active mutation candidate per idempotency key in later implementation;
- conflicting updates require optimistic version checks;
- retries must return the prior receipt rather than duplicate state.

## Audit receipts

Future receipts must record:

- operation and schema version;
- source event and idempotency identities;
- validation and deduplication outcome;
- consent state;
- state transition before/after;
- operator or automated component identity;
- timestamp;
- rejection/override reason;
- linked Lead and Booking-request identifiers;
- unresolved effects;
- no secret values.

## KPI design

Design-only KPI definitions:

- valid interaction rate;
- Lead creation rate;
- duplicate/rejection rate;
- consent-complete rate;
- qualification rate;
- Booking-request rate;
- staff-confirmation rate;
- interaction-to-confirmed conversion rate;
- median response and handoff time;
- source/channel conversion rate;
- attribution completeness;
- cancellation and expiry rate.

No live KPI was queried or calculated in Stage 03.

## Kill switch and rollback

- Kill switch owner: `AYMAN`;
- kill action for this design stage: stop documentation changes and return to fail-closed;
- later runtime kill switches must disable the specific operation, queue or credential without disabling unrelated channels;
- rollback for this stage is a new auditable branch commit restoring the prior design document;
- no remote state rollback exists because no runtime or external state changed.

## Financial and execution receipt

- external API calls: `0`;
- Workflow executions: `0`;
- n8n executions: `0`;
- chatbot runtime executions: `0`;
- CRM writes: `0`;
- Booking writes: `0`;
- paid AI calls: `0`;
- generated images: `0`;
- generated videos: `0`;
- publishing/scheduling/webhooks: `0`;
- Lighthouse/PageSpeed/Insights runs: `0`;
- Production/Supabase/Storage connections: `0`;
- `main` modifications: `0`.

## Final state

`FAIL-CLOSED / NOT AUTHORIZED FOR STAGE 04`

Stage 04 `CONTENT CALENDAR (DRAFT-ONLY)` requires a separate explicit instruction, a new exact target SHA and its own completed Gate.