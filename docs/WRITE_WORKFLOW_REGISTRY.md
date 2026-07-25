# Write and Workflow Registry

This registry defines the known application write boundaries and the governance required around them. Any new write path must update this document in the same pull request.

## Rules

- Browser code must not write directly to database tables.
- Approved writes use named Supabase RPC functions with server-side RBAC and validation.
- Sensitive actions require explicit user confirmation and a single in-flight lock.
- External publishing remains human-reviewed and must have a narrow kill switch.
- Every production write must be attributable to an authenticated actor or approved service identity.
- Secrets, service-role keys, and provider credentials must never be exposed to the browser or logs.

## Registry

| Capability | Approved boundary | Current state | Human approval | Audit requirement | Kill switch |
| --- | --- | --- | --- | --- | --- |
| Conversation mode change | `set_staff_conversation_mode` | Active, role-gated | Explicit confirmation | Actor, conversation, old/new mode, time, result | Force `human_required` or `paused` |
| Booking status change | `update_booking_request_status` | Active, role-gated | Explicit confirmation | Actor, booking, old/new status, time, result | Disable status mutation UI/RPC access |
| Content item edit | `update_staff_content_item` | Active, role-gated; published content protected | Explicit confirmation | Actor, item, changed fields, time, result | Disable content-write capability |
| Content review/schedule transition | `transition_staff_content_item` | Active, role-gated | Explicit confirmation | Actor, item, old/new state, time, result | Disable transitions and publishing |
| Media library | None | Read-only | Not applicable | Read errors only; no private URL exposure | Not applicable |
| Growth analytics | None | Read-only | Not applicable | Read errors and validation failures | Not applicable |
| Integrations operations queue | None | Read-only | Not applicable | Read errors, overdue visibility | Disable affected integration outside this UI |
| External publishing | Approved provider workflow, not implemented by this GOV-B change | Controlled/pending | Required before release | Content, destination, approver, provider result, idempotency key | Global publishing pause |
| Chatbot automated response | Approved chatbot runtime, not changed by this GOV-B change | Controlled by conversation mode | Human takeover path required | Conversation, mode, model/provider result, time | Pause chatbot or force human mode |
| Environment configuration | Vercel/Supabase settings | Account-level operation | Deployment/data owner | Actor, changed key name only, scope, time; never value | Restore previous configuration or deployment |
| Deployment | Vercel deployment from protected repository | Active | Protected merge and CI | Commit, deployment ID, actor, result | Promote known-good deployment |

## Required fields for future write entries

Every added write path must document:

1. Business purpose and data affected.
2. Exact approved API or RPC boundary.
3. Roles permitted to execute it.
4. Validation and idempotency behavior.
5. Confirmation requirement.
6. Audit event and retention location.
7. Narrow kill switch and owner.
8. Rollback or compensating action.
9. Tests proving RBAC, duplicate prevention, error handling, and session expiry.

## Prohibited write patterns

- Direct client-side table insert, update, or delete.
- Browser use of service-role credentials.
- Silent publishing or outbound messaging without approved policy.
- Retrying non-idempotent writes without a deduplication key.
- Multiple simultaneous writes for the same controlled action.
- Destructive rollback as the first incident response.
- Logging content, tokens, credentials, or private media URLs beyond approved operational necessity.