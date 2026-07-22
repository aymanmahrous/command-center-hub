# Bookings Operations Handoff

## Scope implemented

- The Bookings module continues to read only through `get_staff_bookings`.
- Operational cards now show the complete existing booking context needed by staff: requested slot, service, location, swimming experience, fear-of-water warning, phone, and request time.
- Staff can search by customer and booking details and filter through live status summary counts.
- The only mutation remains `update_booking_request_status(p_booking_request_id, p_status)`.

## Safety controls

- Write roles remain `super_admin`, `admin`, and `reception`, matching the existing RPC contract.
- Every status transition requires explicit confirmation.
- A single in-flight lock prevents repeated or concurrent status writes from the interface.
- The existing RPC validates the status and records `booking_request_status_updated` in `audit_logs`.
- Session expiry signs the user out rather than presenting an uncertain result.
- Invalid data and rejected updates fail closed.
- No table mutation, migration, RLS/policy, cron, worker, service-role credential, message, webhook, secret, public-site change, or Production database write is introduced.

## Verification

- `npm run typecheck`: passed.
- `npm test`: passed, 15/15 tests.
- `npm run build`: passed with Vite production output.
- `git diff --check`: passed.
- Protected pull-request CI: pending.

## Rollback

Revert the Bookings feature merge commit or redeploy the previous successful Command Center deployment. Existing booking data and the public Relax Fix UAE website remain unchanged.

## Next required action

Review the final diff for scope and regression risk, then open a dedicated Bookings pull request and wait for protected CI and independent approval.
