# Command Center Hub Project Handoff

## Current stage

Bookings operations on branch `feat/bookings-operations-view` after the protected merge of AI Inbox PR #9.

## Implemented

- Real conversation list through the existing `get_staff_inbox` RPC.
- Real message history through `get_staff_conversation_messages`.
- Confirmed, role-gated conversation mode changes through `set_staff_conversation_mode`.
- Complete mode support: `ai_active`, `human_required`, `human_takeover`, and `paused`.
- In-flight locking, safe error states, session-expiry handling, and responsive UI.
- Security-contract coverage for RPC-only writes, RBAC, confirmation, duplicate prevention, and the mode allowlist.
- Bookings operational summary, search, status filters, full existing request context, and safe session-expiry handling.
- Bookings status writes remain exclusively on `update_booking_request_status` with confirmation and a single in-flight lock.

## Verified evidence

- `npm run typecheck`: passed on 2026-07-22.
- `npm test`: passed 13/13 on 2026-07-22.
- `npm run build`: passed on 2026-07-22.
- No migration, RLS/policy, cron, worker, public-site, direct-table-write, or service-role change exists in the branch.
- AI Inbox PR #9 merged after an independent approval and successful required checks on 2026-07-22.
- Bookings local verification passed: TypeScript, 15/15 tests, production build, and diff check.

## Pending / blocked

- Review the final Bookings diff for scope and regression risk.
- Open a dedicated Bookings pull request and wait for protected CI and independent approval.
- No permission or implementation blocker is currently known.

## NEXT_REQUIRED_ACTION

Complete Bookings verification, open its pull request, merge only after CI and protection requirements pass, then begin Content Studio from updated `main`.

## Prohibited actions

- Do not create or edit migrations, RLS, policies, cron, or workers.
- Do not expose service-role credentials or write directly to tables.
- Do not modify or deploy the public Relax Fix UAE site.
