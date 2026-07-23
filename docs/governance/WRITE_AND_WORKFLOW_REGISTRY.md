# Write and Workflow Registry

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

## Rule

Browser code is deny-by-default for writes. No direct table write, service-role credential, provider credential, Storage mutation, publication, outbound message, migration or deployment action may originate in the browser. Only named server-enforced RPC transitions may be considered, and GOV-F does not authorize their execution.

## Registered paths

| Path | Classification | Target | Status |
|---|---|---|---|
| `get_staff_inbox`, `get_staff_conversation_messages` | Read | Database | Current read path |
| `set_staff_conversation_mode` | Controlled RPC write | Database | BLOCKED for activation; explicit staff action and audit required |
| `update_booking_request_status` | Controlled RPC write | Database | BLOCKED for activation; explicit staff action and audit required |
| `update_staff_lead_workflow` | Controlled RPC write | Database | BLOCKED; PR #8 stale/non-merge-ready |
| `update_staff_content_item` | Controlled RPC write | Database | BLOCKED for activation |
| `transition_staff_content_item` | Controlled RPC/state write | Database/scheduling state | BLOCKED; publishing excluded |
| Governance branch commits | Git write | Repository branch | Current only under explicit instruction |
| PR metadata, merge, labels, comments | GitHub write | Repository metadata | BLOCKED without separate authority |
| Migrations/RLS/policies/cron/workers | Write | Database | BLOCKED |
| AI generation | Write | Provider/Database | BLOCKED |
| Publishing/outbound messaging | Write | Provider/external account | BLOCKED |

## Browser runtime write blocklist

The following are explicitly prohibited from browser/client execution:

- direct `/rest/v1/<table>` POST/PATCH/PUT/DELETE;
- browser use of service-role, secret, database-password or provider keys;
- direct Storage upload/update/delete with elevated credentials;
- migration, DDL, RLS, policy, grant, cron or worker control;
- AI/provider generation calls using protected credentials;
- publishing, scheduling, webhook dispatch or outbound messaging;
- arbitrary RPC invocation not named and approved in this registry.

Kill switches, owners, independent approvers and rollback evidence remain governed by `RISK_OWNERSHIP_MATRIX.md` and the GOV-C records. Every rollback must be a new auditable action; history rewriting and undocumented direct database correction are prohibited.