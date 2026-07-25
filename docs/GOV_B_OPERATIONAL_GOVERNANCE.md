# GOV-B — Documentation & Operational Governance

Baseline commit: `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`
Baseline pull request: `#18` — Performance Review
Target branch: protected `main`

## Purpose

GOV-B establishes the documentation, ownership, monitoring, rollback, write-control, and emergency-stop rules required before GOV-C. It does not change production runtime behavior, database objects, Supabase policies, public-site files, deployments, secrets, cron jobs, or workers.

## Environment requirements

- Node.js 20 or newer; Node 22 is the CI reference.
- npm with the committed lockfile; use `npm ci` for clean installs.
- A publishable or anonymous Supabase browser key only. Service-role keys are prohibited in browser environments.
- Required browser environment values must be supplied through approved local or Vercel environment configuration and must never be committed.
- Production verification command: `npm run verify`.

## Core commands

- Development: `npm run dev`
- Type validation: `npm run typecheck`
- Tests: `npm test`
- Production build plus performance budget: `npm run build`
- Full verification: `npm run verify`
- Local production preview: `npm run preview`

## File and operating map

| Area | Primary paths | Purpose |
| --- | --- | --- |
| Application entry and UI | `src/` | Authenticated Command Center frontend and operational modules |
| Validation and contracts | `src/`, `tests/` | Runtime schema validation, RBAC-facing contracts, regression tests |
| Build and budgets | `package.json`, `scripts/check-performance-budget.mjs` | Typecheck, build, and initial-load performance enforcement |
| CI | `.github/workflows/` | Protected verification pipeline |
| Governance and runbooks | `PROJECT_HANDOFF.md`, `docs/` | Handoff, rollback, monitoring, write registry, and stage controls |
| Deployment configuration | Vercel project settings | Environment values, logs, alerts, deployment history, rollback |
| Data and RPC boundary | Supabase RPC functions consumed by the frontend | Approved reads and role-gated writes; no direct table writes from the UI |

## Ownership matrix

| System area | Accountable owner | Operational responsibility | Approval required |
| --- | --- | --- | --- |
| Repository and protected `main` | Repository owner | Branch protection, merges, releases, tags | Independent review plus required CI |
| Frontend application | Application maintainer | UI, validation, client safety, tests | PR review and CI |
| Supabase authentication and RPC boundary | Backend/data owner | RPC contracts, RBAC, RLS, policies, database safety | Explicit database-owner approval |
| Vercel deployment | Deployment owner | Environment configuration, logs, alerts, rollback | Repository owner or delegated deployment owner |
| Publishing operations | Content operations owner | Review, schedule, publish, pause | Human approval before external publication |
| Incident response | Incident commander | Triage, kill switch, rollback, recovery declaration | Owner confirmation for production-impacting actions |
| Security review | Security reviewer | Secret handling, auth boundary, dependency findings | Required for auth, credentials, RLS, policies, or public exposure |

## Monitoring governance

The following signals are required for production operation:

1. Vercel deployment and build failures.
2. Runtime exceptions and repeated request failures.
3. Latency regressions for initial page load and operational RPC requests.
4. Memory or function-resource anomalies where exposed by the hosting plan.
5. Authentication failures, expired sessions, and authorization denials.
6. Publishing or workflow jobs that fail, stall, duplicate, or exceed their expected window.

Activation in Vercel must be performed by the deployment owner because repository changes alone cannot safely prove or configure account-level alerts. Evidence of activation must be recorded in the project handoff or an incident/operations log without exposing secrets.

## Change-control rules

- Every production-affecting change uses a dedicated branch and pull request.
- `main` remains protected; no direct commits.
- Required CI and independent approval must pass before merge.
- Database migrations, RLS, policies, cron, workers, service-role credentials, and public-site changes require a separately approved scope.
- Monitoring configuration, environment changes, and deployment rollback are operational changes and must be logged with actor, time, reason, and result.

## Kill-switch hierarchy

Use the narrowest switch that stops harm while preserving unaffected services:

1. Disable publishing or outbound actions.
2. Pause the chatbot or force human-required mode.
3. Disable the affected API/RPC route or integration.
4. Roll back the deployment to the last known-good release.
5. Stop the full runtime only when narrower controls cannot contain the incident.

Kill-switch actions must be reversible, logged, and followed by verification. Never delete production data as a kill-switch mechanism.

## GOV-B completion criteria

GOV-B is complete only when:

- The handoff reflects PR #18 and commit `312c30b`.
- Environment requirements, core commands, file map, and ownership are documented.
- Monitoring requirements and evidence expectations are documented.
- Rollback and release procedures are documented and tested in a non-destructive manner.
- The write/workflow registry lists every known write boundary and approval rule.
- Kill-switch ownership and activation paths are documented.
- CI passes and an independent reviewer approves the GOV-B pull request.

## GOV-C readiness

GOV-C may begin only after the GOV-B pull request is merged to protected `main`, required checks are green, monitoring activation evidence is recorded, and no unresolved review or incident remains.