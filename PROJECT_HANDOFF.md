# Command Center Hub Project Handoff

## Current stage

Controlled AI Inbox on branch `feat/controlled-ai-inbox`.

## Implemented

- Real conversation list through the existing `get_staff_inbox` RPC.
- Real message history through `get_staff_conversation_messages`.
- Confirmed, role-gated conversation mode changes through `set_staff_conversation_mode`.
- Complete mode support: `ai_active`, `human_required`, `human_takeover`, and `paused`.
- In-flight locking, safe error states, session-expiry handling, and responsive UI.
- Security-contract coverage for RPC-only writes, RBAC, confirmation, duplicate prevention, and the mode allowlist.

## Verified evidence

- `npm run typecheck`: passed on 2026-07-22.
- `npm test`: passed 13/13 on 2026-07-22.
- `npm run build`: passed on 2026-07-22.
- No migration, RLS/policy, cron, worker, public-site, direct-table-write, or service-role change exists in the branch.

## Pending / blocked

- GitHub pull request, protected CI, and merge are pending.
- No permission blocker is currently known.

## NEXT_REQUIRED_ACTION

Commit and push `feat/controlled-ai-inbox`, open its pull request, wait for required CI and branch protection, and merge only after all checks pass. Then begin the next requested Command Center module on a fresh branch from updated `main`.

## Prohibited actions

- Do not create or edit migrations, RLS, policies, cron, or workers.
- Do not expose service-role credentials or write directly to tables.
- Do not modify or deploy the public Relax Fix UAE site.
