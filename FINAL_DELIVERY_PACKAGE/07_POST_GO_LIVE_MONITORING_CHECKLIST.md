# Post Go-Live Monitoring Checklist

This is a forward-looking operational checklist for after each outstanding go-live gate (Section 6) is closed. It does not claim any of the following monitoring is currently active unless a source document says so; unconfirmed items are marked **PENDING OWNER** (owner or delegated manager to establish).

## Availability and deployment

- [ ] Monitor Vercel Production deployment status for both projects (`swim-fluent-uae-w532`, Command Center Hub) after every deploy.
- [ ] Confirm production domains continue to resolve (`relaxfixuae.com`, `www.relaxfixuae.com`) and the Command Center Hub URL stays reachable.
- [ ] Watch the daily content-automation cron job (`/api/cron/content-automation`, 00:15 UTC) for failures.

## Security and database

- [ ] Re-run Supabase advisors periodically; track resolution of the currently open items (leaked-password protection disabled, 33 RLS-no-policy tables, 1 extension-in-public warning, 15 performance notices).
- [ ] Confirm the CI regression guard continues to fail builds if any privileged Postgres function becomes anonymously executable (in place per PR #207/#210 — verify it stays enforced).
- [ ] Review Supabase Auth settings (rate limits, CAPTCHA, password policy, MFA, redirect allowlist, session lifetime) against policy at least once post-launch — not yet independently confirmed.

## Booking and revenue path

- [ ] Track real booking submissions end-to-end once live (booking-ingress hardening is deployed; ongoing monitoring of submission success/error rates is not yet established — **PENDING OWNER** to assign an owner for this).
- [ ] Confirm lead follow-up / human handoff ownership is staffed and being executed (ODQ-05 dependency).

## Publishing and content

- [ ] After the first Facebook post is executed, verify the receipt (Post ID, link, timestamp, execution ID) and confirm no automatic retry occurred on ambiguous outcomes.
- [ ] Track weekly content approval → media production → publish cadence against the approved 30-day plan.
- [ ] Confirm the n8n approved workflow (`xNwYPSXQiUyzDSyZ`) executions are logged and reviewed; confirm the two retired workflow IDs remain inactive.

## Analytics and paid acquisition (only once activated)

- [ ] Once GA4 is approved and activated, confirm no duplicate/PII data is captured and that the feature flag can be rolled back quickly if needed.
- [ ] Once any paid campaign starts, monitor spend against the approved budget/stop-loss rules (ODQ-07) and confirm `booking_complete` conversion tracking is accurate before scaling spend.

## PWA (once merged/promoted)

- [ ] Confirm Android install/offline behavior with real evidence (screenshot or recording) rather than owner attestation alone, before relying on it operationally.
- [ ] Re-confirm private routes (`/admin`, `/staff`, `/os`) never enter the service-worker cache after any PWA-related change.

## Cadence

**PENDING OWNER** — no monitoring cadence (daily/weekly/monthly) or named responsible party is recorded in project documentation for any of the above. This should be assigned before go-live.
