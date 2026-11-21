# Command Center Hub

## Repository guidance

Read [`AGENTS.md`](AGENTS.md) for the repository rules. [`MASTER_PROJECT_HANDOFF.md`](MASTER_PROJECT_HANDOFF.md) is the only current project-state handoff. Consult technical documentation only when it is relevant to the task; documents in [`docs/archive/`](docs/archive/) are historical.

Private internal operations application for RelaxFix UAE. This repository is independent from the public Relax Fix UAE website and must never be used to modify or deploy that site.

## Application overview

- Staff authentication through Supabase Auth plus one active `staff_profiles` record.
- Operational dashboards for Command Center, AI Inbox, CRM, automation status, Content Studio, Bookings, Media Library, Analytics, and Integrations.
- Controlled writes only through approved RPCs for booking status, CRM workflow, conversation mode, and content review/scheduling transitions.
- Explicit confirmation, UI RBAC, duplicate-write locking, safe session expiry, and RPC-side audit logging.
The authoritative verified status and next safe action are in [MASTER_PROJECT_HANDOFF.md](MASTER_PROJECT_HANDOFF.md).

## Local verification

Requirements: Node.js 22 (CI runtime; Node.js 20 or newer is supported by the package contract) and npm.

```bash
npm ci --ignore-scripts
npm run verify
```

`npm run verify` runs TypeScript validation, all contract tests, the production build, and the initial-load performance budget.

Run `npm run deps:check` to report outdated direct/transitive packages and known vulnerabilities. It requires dependencies to be installed and npm registry access; it is read-only, never updates packages or the lockfile, and exits nonzero when it finds issues.

## Browser-safe environment contract

Copy `.env.example` to an untracked local `.env` and provide:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (preferred)
- `VITE_SUPABASE_ANON_KEY` (legacy fallback only; JWT role must be `anon`)
- `VITE_STAFF_PROFILE_TABLE`

Never place a secret key, service-role key, database password, webhook secret, or provider credential in a `VITE_*` variable. The application rejects unsafe or malformed API keys and fails closed when configuration or staff authorization is invalid.

## Data and mutation boundary

Operational reads use existing staff RPCs. The only direct REST table access is the read-only active staff-profile authorization check. Approved mutations are limited to:

- `update_booking_request_status`
- `update_staff_lead_workflow`
- `set_staff_conversation_mode`
- `update_staff_content_item`
- `transition_staff_content_item`

The browser must not write directly to tables. Do not add migrations, RLS/policy changes, cron, workers, service-role access, publishing secrets, or production-setting changes through feature work in this repository.

## Documentation map

- [Current project state](MASTER_PROJECT_HANDOFF.md)
- [Repository rules](AGENTS.md)
- [Final audit](docs/FINAL_AUDIT.md)
- [Final security review](docs/FINAL_SECURITY_REVIEW.md)
- [Performance review](docs/PERFORMANCE_REVIEW.md)
- [Historical archive](docs/archive/)
- [Audited baseline manifest](AUDITED_BASELINE_CONTENT_MANIFEST.md)

Archived handoffs, rules, plans, and status reports are preserved for history only. They are not the current project state or operating rules.
