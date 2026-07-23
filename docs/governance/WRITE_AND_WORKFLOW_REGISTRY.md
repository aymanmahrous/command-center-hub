# Write and Workflow Registry

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner

## Rules

- This is a source-review registry, not an execution authorization.
- `Current` means the path exists in the reviewed repository history; it does not prove Production configuration.
- `Blocked` means no execution, activation, merge, provider call, database write, or deployment is authorized.
- Browser code must not write directly to tables. Controlled writes must use the named RPC and server-enforced role checks.
- Independent approver must be a person other than the change author/operator.

## Registry

| Repository | Workflow/API/RPC | Read/Write | Target | Trigger | Allowed environment | Required role | Secret scope | Human approval | Idempotency | Audit receipt | Rollback procedure | Owner | Independent approver | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| command-center-hub | `get_staff_inbox`, `get_staff_conversation_messages` | Read | Database | Staff UI request | Local / Preview / Production read-only | authenticated active staff | browser-safe Supabase publishable/anon key + staff session | No per-read approval | N/A | access/error logs only; no mutation receipt | disable affected view or revert UI commit | Staff Operations Owner | Security Reviewer | Current |
| command-center-hub | `set_staff_conversation_mode` | Write | Database | Explicit staff UI action | Preview after approval; Production only after GOV-D/E and release approval | server-permitted staff role | browser-safe key + staff session; no service role in browser | Required per action through explicit confirmation | in-flight lock; server mutation contract | RPC audit result / audit log reference | switch conversation to `paused` or `human_takeover`; revert UI/RPC integration commit if necessary | Staff Operations Owner | Independent Operations/Security Approver | Current — execution not authorized by GOV-C |
| command-center-hub | `update_booking_request_status` | Write | Database | Explicit staff UI action | Preview after approval; Production only after GOV-D/E and release approval | `super_admin`, `admin`, `reception` or stricter server rule | browser-safe key + staff session | Required per status change | in-flight lock; reject unchanged/duplicate action | RPC-provided audit evidence | restore prior status through approved RPC when valid, otherwise compensating status plus audit note; revert client integration | Booking Operations Owner | Independent Operations Approver | Current — execution not authorized by GOV-C |
| command-center-hub | `update_staff_lead_workflow` | Write | Database | Explicit staff UI action | No current execution candidate; future Preview only after reimplementation and approval | `super_admin`, `admin`, `reception` or stricter server rule | browser-safe key + staff session | Required per CRM change | proposed in-flight lock and server validation | required RPC audit receipt | disable CRM mutation UI; recreate previous lead state only through approved RPC/compensating action; revert isolated PR | CRM Operations Owner | Independent Security/Operations Approver | Blocked — PR #8 stale/non-merge-ready |
| command-center-hub | `update_staff_content_item` | Write | Database | Explicit staff UI action | Preview after approval; Production only after GOV-D/E and content release approval | server-permitted content role (`super_admin`/`admin`/`content_manager` or stricter) | browser-safe key + staff session | Required per edit | lock while request is in flight; server validation | RPC audit evidence | restore prior content values using approved RPC and preserved before-state; revert isolated client commit | Content Operations Owner | Independent Content/Operations Approver | Current — execution not authorized by GOV-C |
| command-center-hub | `transition_staff_content_item` | Write | Database / scheduling state | Explicit review/schedule action | Preview after approval; Production only after GOV-D/E and publishing governance | server-permitted content role | browser-safe key + staff session | Required for review/schedule transition | server state-transition guard + in-flight lock | transition audit receipt | transition back only through a permitted compensating state; disable scheduling controls; revert isolated integration | Content Operations Owner | Independent Publishing Approver | Current — publishing remains blocked |
| command-center-hub | Governance file updates on `agent/phase-a-source-of-truth` | Write | Git repository | Manual contents-API commit | Governance branch only | repository write access | GitHub app/repository scope only | Explicit user instruction required | commit SHA and branch containment | Git commit SHA + compare-to-main diff | revert governance commit on branch; never rewrite history or touch `main` | Governance Owner | Independent Governance Reviewer | Current |
| command-center-hub | GitHub PR merge/close/retarget/labels/comments | Write | GitHub governance metadata | Manual | None during GOV-C | repository maintainer | GitHub repository metadata scope | Separate explicit authorization | GitHub operation identity | PR timeline receipt | reverse label/base where safe; merge cannot be silently undone and requires revert PR | Repository Owner | Independent Repository Approver | Blocked |
| command-center-hub | Database migration / RLS / policy / cron / worker changes | Write | Database | Manual workflow or operator action | Disposable only for future tests; Production requires separate protected approval | Database Operator | least-privilege database deployment secret | Mandatory two-person approval | migration identity + advisory/concurrency policy | migration log, target SHA, schema diff, post-check | forward-fix or approved down/compensating migration; restore from backup/PITR where applicable | Database Owner | Independent Database/Security Approver | Blocked |
| command-center-hub | AI provider generation | Write | Provider / Database | Manual API action | None | AI Operator + permitted staff role | dedicated provider secret, never browser-exposed | Mandatory | request/run ID, rate/cost limits | provider receipt + local audit row | disable provider secret/feature flag; cancel queued work; preserve audit | AI Operations Owner | Independent AI Risk Approver | Blocked |
| command-center-hub | Publishing / outbound messaging | Write | Publishing provider / external account | Manual or future schedule | None | Publishing Operator | dedicated least-privilege provider secret | Mandatory per release/batch | content fingerprint + provider receipt | publication/message receipt | stop scheduler, revoke/disable credential, unpublish/correct where supported, record incident | Publishing Owner | Independent Brand/Compliance Approver | Blocked |

## Kill switches

| Sensitive path | Stop method | Kill switch owner | After stop |
|---|---|---|---|
| Conversation mode writes | disable mutation UI or set affected conversations to `paused`/`human_takeover` through approved RPC | Staff Operations Owner | retain read access; review audit receipts; investigate pending actions |
| Booking status writes | disable status controls/feature exposure and revoke affected role permission if necessary | Booking Operations Owner | bookings remain readable; no further status transitions; reconcile last successful receipt |
| CRM writes | keep PR #8 unmerged; no active mutation UI | CRM Operations Owner | CRM remains read-only until a new isolated PR passes later gates |
| Content writes/transitions | disable edit/transition controls; prevent scheduling transitions | Content Operations Owner | content remains readable; pending items stay in current state; preserve before/after evidence |
| Database migration | do not dispatch/apply; remove operator access from protected environment if needed | Database Owner | run read-only inventory and incident review; choose forward-fix/restore plan |
| AI/provider | unset/disable dedicated provider credential or feature flag in protected environment | AI Operations Owner | reject new requests, cancel queued jobs where supported, preserve run/audit IDs |
| Publishing/outbound | disable scheduler/adapter and revoke least-privilege token | Publishing Owner | halt new sends/publications; reconcile ambiguous receipts; correct/unpublish only with approval |
| Governance writes | stop commits to governance branch | Governance Owner | compare branch to `main`, preserve commits, revert only by new commit if required |

## Rollback evidence standard

Every rollback requires: affected path, initiating user, approval identity, before-state, after-state, commit/request/run ID, timestamps in Asia/Dubai and UTC where available, verification result, unresolved side effects, and a link or identifier for the audit receipt. Rollback must use a new auditable action; history rewriting is prohibited.
