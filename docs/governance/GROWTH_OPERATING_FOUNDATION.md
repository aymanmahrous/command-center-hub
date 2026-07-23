# Omnichannel Growth Operating Foundation

Document status: APPROVED — EXECUTION GATED
Authority: STRATEGIC OPERATING FOUNDATION
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner

## Decision

`GROWTH-OPERATING-FOUNDATION: APPROVED — EXECUTION GATED`

This document is the strategic operating basis for visibility, local discovery, lead capture, booking conversion, automation and controlled publishing. Approval of this foundation does not authorize account connection, credential creation, API calls, data writes, AI generation, scheduling or publishing. Each activation requires a separate registered operation and complete activation gate.

## Repository role

`command-center-hub` is the governance and control plane. It may present read-only health, approvals, audit receipts, queue state, channel status and exception handling. It must not hold provider secrets in browser code or become a direct publishing/database-write client.

## Strategic objectives

1. Increase qualified organic search visibility.
2. Increase local visibility in Abu Dhabi and relevant UAE service areas.
3. Improve Google Maps and Google Business Profile discovery and conversion.
4. Establish measurable SEO and Local SEO operating loops.
5. Coordinate controlled multi-channel content distribution.
6. Route every valid interaction into a traceable Lead or Booking path.
7. Connect chatbot, CRM and booking through server-enforced, idempotent operations.
8. Preserve rollback, attribution, privacy, approval and auditability across all channels.
9. Scale without coupling migrations, providers, publishing and product features in one release.

## Universal governance rules

- Deny by default. No channel is connected or activated merely because it is listed here.
- Every channel requires verified ownership, exact account/property IDs, named operator, independent approver, credential scope, expiry, kill switch, rollback and audit receipt.
- Credentials are server-side only and separated by provider and purpose.
- Read, draft, schedule, publish, reply, lead-create and booking-create are distinct operations and require separate authorization.
- No browser-held provider, service-role, webhook-signing or publishing secret.
- No automatic publishing before a successful draft-only and approval-only stage.
- No unreviewed AI output may be published or sent to a customer.
- Every inbound event must be authenticated, deduplicated, normalized, consent-aware and traceable to its source.
- Every write must be idempotent and concurrency controlled.
- Migrations are separate database-only PRs and may not be bundled with channel or feature work.
- Failures must stop safely without fallback to another provider, account or destination.
- `main`, Production, providers and customer data remain untouched until separate explicit activation.

## 1. Google Business Governance

Purpose: improve branded and service discovery, profile completeness, trust and conversion.

Governed assets: business name, primary/secondary categories, services, description, hours, phone, website, appointment URL, photos, posts, Q&A, reviews and UTM-tagged links.

Required controls:
- verified GBP ownership and exact location ID;
- NAP consistency with website and structured data;
- owner approval for category, service-area, hours and identity changes;
- media rights and privacy review;
- review-reply policy with human approval for complaints, legal, safety or refund issues;
- no keyword stuffing, fake locations, fake reviews or prohibited incentives;
- audit receipt for every profile change, post and reply.

Initial eligible stage: read-only inventory and discrepancy report. Profile mutations and posts remain blocked until separately authorized.

## 2. Google Maps Governance

Purpose: improve accurate Maps presence and local conversion without creating duplicate or misleading listings.

Required controls:
- one authoritative location/entity record;
- exact address or approved service-area model;
- duplicate-listing detection and owner decision before merge/removal requests;
- map pin, phone, hours, category and website consistency;
- no virtual-office, false-address or location-spam strategy;
- local landing pages must represent real service coverage and unique useful content.

Initial eligible stage: read-only listing, citation and duplicate audit.

## 3. SEO Governance

Purpose: create sustainable organic visibility based on technical quality, useful content and measurable conversion.

Governed areas:
- crawlability, indexability, canonicals, redirects, sitemap, robots, status codes;
- titles, descriptions, headings, internal links and structured data;
- performance, accessibility, mobile usability and Core Web Vitals evidence;
- content briefs, topic clusters, service pages, FAQs and conversion paths;
- Search Console and analytics measurement.

Required controls:
- source-controlled changes on exact SHA;
- no doorway pages, cloaking, copied content or bulk low-value pages;
- schema must match visible page content;
- every landing page has owner, search intent, target geography, CTA and measurement plan;
- content publication requires separate editorial and release approval.

Initial eligible stage: source-only SEO audit and read-only public-site verification.

## 4. Local SEO Governance

Purpose: improve discovery for genuine Abu Dhabi and UAE service demand.

Operating model:
- authoritative NAP and service-area data;
- Abu Dhabi-focused service pages only where service is genuinely available;
- neighborhood and intent research without fabricated offices;
- Arabic and English content where quality and review are available;
- local citations, review velocity, local links and GBP activity measured independently;
- local rank tracking uses documented locations, devices and query sets.

Required controls:
- one canonical local entity dataset;
- legal/privacy review for customer stories and images;
- no city-page duplication with token substitutions;
- lead and booking attribution by landing page, campaign and source.

Initial eligible stage: read-only NAP/citation/content-gap audit.

## 5. Meta Governance — Facebook and Instagram

Purpose: distribute approved content, capture inquiries and route them into controlled CRM/booking flows.

Required controls:
- exact Business Manager, Page, Instagram account and app IDs;
- least-privilege tokens separated for read, insight, draft and publish operations;
- human approval before first publish and for regulated, promotional or sensitive content;
- comment/DM ingestion requires webhook verification, consent handling, spam controls and redaction;
- no automatic public replies to complaints, emergencies, legal matters or sensitive personal data;
- media rights, brand safety and expiry controls;
- publishing idempotency by channel, account, content fingerprint and scheduled slot.

Initial eligible stage: account/permission inventory and read-only insights. Publishing remains frozen.

## 6. TikTok Governance

Purpose: build short-form discovery and conversion while controlling brand, music, privacy and publishing risk.

Required controls:
- verified Business account and exact account/app identifiers;
- licensed audio and media rights;
- platform-compliant claims and disclosures;
- draft-first workflow with caption, cover, CTA and destination review;
- no automated comment/DM action before moderation rules and approved API capability;
- upload, schedule and publish are separate operations with independent receipts.

Initial eligible stage: channel inventory, content taxonomy and manual draft plan. API publishing remains frozen.

## 7. YouTube Governance

Purpose: build durable search visibility, trust and conversion through video and Shorts.

Required controls:
- verified Brand Account/channel ownership;
- upload-default, audience, language, disclosure and moderation policy;
- rights verification for video, music, thumbnails and testimonials;
- title/description/chapter/thumbnail review based on truthful visible content;
- no misleading metadata or mass-generated low-value uploads;
- upload, visibility change, scheduling and comment moderation are separately gated.

Initial eligible stage: channel and content-gap audit; no uploads.

## 8. n8n Governance

Purpose: orchestrate approved processes without becoming an uncontrolled source of truth or a secret-sprawl platform.

Required controls:
- separate Development, Staging and Production instances or projects;
- credentials stored in n8n credential vault/server environment, never workflow JSON or browser code;
- workflow registry with owner, trigger, inputs, writes, providers, retries, timeout, concurrency, idempotency, kill switch and rollback;
- dry-run or shadow mode before any write;
- webhook authentication, replay protection and payload schema validation;
- bounded retries with dead-letter/error queue; no infinite retries or cross-provider fallback;
- immutable execution receipts with redaction and retention limits;
- Production activation requires exact workflow version/hash and independent approval.

Initial eligible stage: architecture and workflow inventory only. No n8n connection or execution.

## 9. Chatbot Governance

Purpose: answer safely, capture consented contact details and route qualified intent to CRM or Booking without impersonating staff or making unsupported commitments.

Required controls:
- clear bot identity, capabilities and escalation path;
- approved knowledge sources with version and freshness tracking;
- no diagnosis, legal commitment, guaranteed availability, unsupported pricing or fabricated answers;
- PII minimization, consent, retention and deletion rules;
- prompt-injection and tool-authorization boundaries;
- read actions separated from lead-create, booking-create, update and messaging actions;
- lead and booking writes are server-mediated, validated, idempotent and auditable;
- human handoff for complaints, emergencies, ambiguity, sensitive data and low confidence;
- AI provider use remains blocked until exact model, token and cost gates are separately approved.

Initial eligible stage: scripted/non-provider conversation and read-only knowledge evaluation. CRM/Booking writes remain blocked.

## 10. Scheduling and Publishing Governance

Purpose: publish the right approved asset to the right account and time with traceable state and safe recovery.

Required lifecycle:
`idea -> draft -> reviewed -> approved -> scheduled -> publishing -> published | failed | cancelled`

Required controls:
- content fingerprint and immutable approved version;
- channel/account/locale/slot-specific idempotency key;
- one active publish lease per channel/account/content/slot;
- timezone fixed to Asia/Dubai unless explicitly overridden;
- approval expiry and reapproval after material edits;
- preflight for credentials, media, links, claims, policy and destination;
- provider receipt and canonical published URL;
- cancellation and kill switch before dispatch;
- rollback is unpublish/delete only when policy and provider permit, otherwise correction with audit trail;
- no automatic reschedule or cross-channel fallback after failure.

Initial eligible stage: offline calendar and approval-state design. Provider scheduling and publishing remain frozen.

## Cross-channel lead and booking model

Every valid interaction should enter a normalized event envelope containing:
- source channel and account/property;
- campaign/content/landing-page identifiers;
- provider event ID and received time;
- consent and contact fields where supplied;
- intent classification and confidence;
- deduplication fingerprint;
- attribution fields and UTM data;
- processing status and audit receipt ID.

The conversion sequence is:
`interaction -> validated event -> deduplicated contact -> Lead -> qualification -> Booking request -> staff confirmation`

A social interaction must not create a confirmed booking automatically. Booking confirmation remains a controlled staff/server transition unless separately approved.

## Measurement framework

Primary outcomes:
- qualified organic sessions;
- Google Business/Maps calls, website clicks, direction requests and bookings;
- Abu Dhabi local query coverage and conversion;
- indexed high-quality landing pages and non-branded search growth;
- channel reach, engagement, qualified conversations and lead rate;
- Lead-to-Booking conversion and time to first response;
- publishing success/failure, duplicate prevention and approval latency.

Guardrails:
- complaint rate, opt-out rate, spam rate, policy violations, duplicate leads, duplicate posts, failed workflows, stale content and unattributed conversions.

## Activation sequence

1. Source-only verification and documentation.
2. Read-only account, profile, SEO, Maps, citation and analytics inventories.
3. Canonical identity, NAP, taxonomy, attribution and consent definitions.
4. Draft-only content and offline scheduling model.
5. Read-only provider insights connections, one provider at a time.
6. n8n dry-run/shadow workflows with synthetic data only.
7. Chatbot scripted evaluation, then read-only knowledge access.
8. CRM/Lead sandbox writes after separate database authorization.
9. Booking-request sandbox flow with staff confirmation.
10. One-channel manual-approved publish pilot.
11. Controlled scheduling pilot with low volume and immediate kill switch.
12. Gradual expansion only after measured PASS receipts.

## Frozen until separate decisions

- all provider credentials and account connections;
- AI generation and AI-powered chatbot tools;
- n8n execution and webhooks;
- CRM and Booking writes;
- Google Business/Maps mutations;
- social/video upload, scheduling, publishing and replies;
- Production database, Storage and migrations;
- bulk content creation, bulk location pages or cross-channel autopublishing.

## Final approval

This strategic plan is approved as the operating foundation for the project. It defines what must be built and how it must be governed. It does not activate any channel. Execution proceeds only through isolated scopes, exact target SHAs, registered operations, independent approvals and fail-closed activation gates.