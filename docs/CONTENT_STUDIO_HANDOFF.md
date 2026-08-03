# Content Studio Operations Handoff

Document status: historical stage evidence. PR #11 was merged after successful protected CI and independent approval on 2026-07-22.

> **Update — Content Publishing v1:** the "no publish action / external platform call" line below described PR #11's scope and is now superseded for that one narrow case. The project owner has explicitly authorized a "Publish now" action (immediate publish only, for `status === 'approved'` items) that calls the Meta Graph API from a new Supabase Edge Function, `safe-content-publisher`. This is tracked separately from PR #11 as a draft PR on branch `claude/safe-content-publisher-deploy-016bra` — see `PROJECT_HANDOFF.md` for current status and `supabase/functions/safe-content-publisher/index.ts` / `supabase/sql/2026xxxx_record_staff_content_publish_result.sql` for the implementation. Everything else in this document (RPC-only writes, RBAC, confirmation, locking, Audit Log) still applies unchanged to the "Publish now" action. Scheduling to Meta and any Instagram cron/poller remain explicitly out of scope.

## Scope

- Real content records are read through the existing `get_staff_content_items` RPC.
- Editing uses only `update_staff_content_item`.
- Approval, return-to-review, scheduling, rescheduling, and unscheduling use only `transition_staff_content_item`.
- The DB-only "Schedule" action above is unchanged and still makes no external platform call.
- The new "Publish now" action (Content Publishing v1) calls the Meta Graph API through `safe-content-publisher`, then records its outcome through a new RPC, `record_staff_content_publish_result`, called with the staff member's own JWT — not service-role — matching the RPC-only write pattern used everywhere else in this document.

## Safety controls

- Server-aligned RBAC: only `super_admin`, `admin`, and `content_manager` can mutate content.
- Every mutation requires an explicit browser confirmation.
- One global in-flight lock prevents duplicate or competing writes.
- Published content is read-only, matching the RPC contract.
- Editing scheduled content warns that its schedule will be cleared and the item returned to review.
- Scheduling requires a valid future time and server-side approval state.
- RPC failures are mapped to safe operator messages; expired sessions are closed.
- Audit Log entries are created inside the existing mutation RPCs.

## Verification

- `npm run typecheck`: passed on 2026-07-22.
- `npm test`: passed 18/18 on 2026-07-22.
- `npm run build`: passed on 2026-07-22.
- `git diff --check`: passed on 2026-07-22.

## Explicit exclusions

- No migration, RLS/policy, cron, direct table write, webhook, public-site change, or Production database write is included.
- No real content was scheduled or published during development or verification of PR #11.
- The single narrow exception to "no worker / no secret" is the explicitly owner-authorized `safe-content-publisher` Edge Function (Content Publishing v1) — see the update note above. It reads Meta credentials only from Supabase Edge Function secrets set directly by the owner, never from this repo, and its proposed RPC is unapplied pending the owner's sign-off.
- Instagram scheduling and any cron/poller-based publishing remain excluded and are a separate, later decision.
