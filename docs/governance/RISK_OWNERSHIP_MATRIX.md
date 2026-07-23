# Risk Ownership Matrix

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

Roles below are accountable role names, not claims that a specific individual has accepted the role. No sensitive path may activate until the Repository Owner records named people and verifies separation of duties.

| Risk domain | Responsible | Independent approver | Kill switch owner | Rollback owner | Current decision |
|---|---|---|---|---|---|
| Governance documents and branch commits | Governance Owner | Independent Governance Reviewer | Governance Owner | Governance Owner | Current on governance branch only |
| GitHub PR lifecycle and merge | Repository Owner | Independent Repository Approver | Repository Owner | Release Owner | Blocked during GOV-C |
| Staff authentication and authorization | Security Owner | Independent Security Reviewer | Security Owner | Security Owner | Current controls; external configuration not verified |
| AI Inbox reads and conversation-mode writes | Staff Operations Owner | Independent Operations/Security Approver | Staff Operations Owner | Staff Operations Owner | Current path; execution not authorized by GOV-C |
| Booking reads and status writes | Booking Operations Owner | Independent Operations Approver | Booking Operations Owner | Booking Operations Owner | Current path; execution not authorized by GOV-C |
| CRM writes | CRM Operations Owner | Independent Security/Operations Approver | CRM Operations Owner | CRM Operations Owner | Blocked; PR #8 stale |
| Content editing and review transitions | Content Operations Owner | Independent Content/Operations Approver | Content Operations Owner | Content Operations Owner | Current path; publishing excluded |
| Database migrations, RLS, policies, cron, workers | Database Owner | Independent Database/Security Approver | Database Owner | Database Recovery Owner | Blocked |
| AI provider access and generation | AI Operations Owner | Independent AI Risk Approver | AI Operations Owner | AI Operations Owner | Frozen/blocked |
| Storage mutation and media generation | Media Operations Owner | Independent Security/Content Approver | Media Operations Owner | Media Operations Owner | Blocked |
| Publishing, scheduling, external messaging | Publishing Owner | Independent Brand/Compliance Approver | Publishing Owner | Publishing/Incident Owner | Blocked |
| Secrets and environment configuration | Security Owner | Independent Security Reviewer | Security Owner | Security Owner | Blocked without protected approval |
| Deployment and Production promotion | Release Owner | Independent Release Approver | Release Owner | Release Owner | Blocked |

## Separation-of-duties rules

1. The Responsible role may prepare a change but may not be its sole approver.
2. The Independent approver must not be the author or operator of the protected action.
3. Kill switch activation may be immediate for safety, but its receipt and reason must be recorded.
4. Rollback owner must verify the before-state, recovery action, and post-rollback state.
5. Repository Owner remains the final authorization authority but does not replace independent approval.
6. Unassigned named people keep the domain `Blocked` for activation.
