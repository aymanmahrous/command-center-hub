# Post Go-Live Checklist

Operational checklist for after each Go-Live Checklist item is closed. Nothing below is claimed as currently active unless stated; unassigned items are marked PENDING OWNER.

## Availability

- [ ] Monitor Vercel Production deployment status for both projects after every deploy
- [ ] Confirm production domains keep resolving (`relaxfixuae.com`, `www.relaxfixuae.com`) and the internal tool URL stays reachable
- [ ] Watch the daily content-automation cron job (00:15 UTC) for failures

## Security and database

- [ ] Re-run Supabase advisors periodically; track resolution of open items (leaked-password protection, 33 RLS-no-policy tables, extension-in-public warning, performance notices)
- [ ] Confirm the CI privileged-function regression guard stays enforced
- [ ] Review Supabase Auth settings (rate limits, CAPTCHA, password policy, MFA, redirect allowlist, session lifetime) — PENDING OWNER, not yet independently confirmed

## Booking and revenue path

- [ ] Track real booking submissions end-to-end once live — PENDING OWNER to assign a responsible party
- [ ] Confirm lead follow-up/human handoff ownership is staffed and active

## Publishing and content

- [ ] Verify the first Facebook publish receipt once executed (Post ID, link, timestamp, execution ID); confirm no automatic retry on ambiguous outcomes
- [ ] Track the weekly content approval → media production → publish cadence against the approved 30-day plan
- [ ] Confirm n8n workflow executions are logged/reviewed; confirm retired workflow IDs remain inactive

## Analytics and paid acquisition (once activated)

- [ ] Confirm GA4 captures no duplicate/PII data and can be rolled back quickly
- [ ] Monitor paid campaign spend against approved budget/stop-loss rules; confirm `booking_complete` conversion accuracy before scaling

## PWA (once merged/promoted)

- [ ] Confirm Android install/offline behavior with real evidence (screenshot/recording), not attestation alone
- [ ] Re-confirm private routes never enter the service-worker cache after PWA-related changes

## Cadence and ownership

PENDING OWNER — no monitoring cadence or named responsible party is recorded in project documentation for any item above. Should be assigned before this checklist is treated as active.
