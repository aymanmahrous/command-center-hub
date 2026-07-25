# Command Center Hub Project Handoff

## Current stage

GOV-B — Documentation & Operational Governance on branch `docs/gov-b-operational-governance`, based on protected `main` at merge commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f` after Performance Review PR #18.

## Stable baseline

- Repository: `aymanmahrous/command-center-hub`
- Protected branch: `main`
- Stable merge commit: `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`
- Completed pull request: #18 — Performance Review
- Verification reported before merge: TypeScript, 33/33 tests, production build, and initial-load performance budget passed.
- Vercel commit status reported successful for the baseline commit.

## PR #18 summary

PR #18 added an enforced initial-load budget to the production build. The build now measures JavaScript and CSS assets referenced by the built entry page, checks raw and gzip sizes, fails closed when the initial JavaScript entry is missing, and rejects assets that exceed the approved limits. Contract tests prove that bounded assets pass and an oversized JavaScript entry fails. The change did not add runtime dependencies or alter application, database, publishing, or public-site behavior.

## Implemented application baseline

- Real AI Inbox conversation list and message history through approved RPC functions.
- Role-gated conversation mode changes through `set_staff_conversation_mode`.
- Booking status changes exclusively through `update_booking_request_status`.
- Content edits through `update_staff_content_item` and controlled transitions through `transition_staff_content_item`.
- Media Library, Analytics, and Integrations operational views remain read-only.
- Browser authentication rejects unsafe API keys and stores only the access token before revalidation.
- Client writes use confirmation, RBAC-aligned RPC boundaries, and in-flight locking.
- Production build enforces JavaScript and CSS initial-load budgets.

## Environment and commands

- Node.js 20 or newer; CI reference is Node 22.
- Install dependencies with `npm ci` using the committed lockfile.
- Use only approved publishable/anonymous browser environment credentials; browser service-role credentials are prohibited.
- Development: `npm run dev`
- Type validation: `npm run typecheck`
- Tests: `npm test`
- Production build and performance gate: `npm run build`
- Full verification: `npm run verify`
- Local production preview: `npm run preview`

## Core paths

- `src/`: application UI, authentication, validation, and operational modules.
- `tests/`: security, workflow, build, and performance regression contracts.
- `scripts/check-performance-budget.mjs`: initial production asset budget gate.
- `.github/workflows/`: protected CI workflows.
- `docs/GOV_B_OPERATIONAL_GOVERNANCE.md`: stage scope, ownership, controls, and completion criteria.
- `docs/MONITORING_RUNBOOK.md`: monitoring requirements and incident response.
- `docs/ROLLBACK_RUNBOOK.md`: release, rollback, and recovery procedure.
- `docs/WRITE_WORKFLOW_REGISTRY.md`: approved write boundaries, approvals, auditing, and kill switches.

## Ownership summary

- Repository owner: branch protection, merges, tags, releases, and final production authority.
- Application maintainer: frontend, validation, tests, and safe client behavior.
- Backend/data owner: Supabase RPC contracts, RBAC, RLS, policies, and database recovery.
- Deployment owner: Vercel configuration, logs, alerts, deployments, and rollback.
- Content operations owner: review, scheduling, publishing approval, and publishing pause.
- Incident commander: severity, containment, kill switch, rollback decision, and recovery declaration.
- Security reviewer: authentication, credentials, dependency and exposure review.

## GOV-B changes in this branch

- Added operational governance baseline and completion criteria.
- Added monitoring and incident runbook.
- Added rollback and GitHub Release/tag strategy.
- Added write/workflow registry for all known write boundaries.
- Defined narrow-to-broad kill-switch hierarchy and ownership.
- Documented that Vercel account-level alerts and runtime monitoring require deployment-owner activation and evidence; repository documentation cannot truthfully activate those settings.

## Pending operational evidence

- Vercel deployment owner must confirm failure notifications, runtime log access, alert recipients, and available latency/resource monitoring.
- The deployment identifier matching commit `312c30b` must be recorded.
- An approved annotated Git tag and GitHub Release should be created only after GOV-B is reviewed and merged.
- No production environment, deployment, Supabase, publishing, chatbot, API, or runtime setting has been changed by this documentation branch.

## GOV-B completion gate

- `npm run verify` passes on the GOV-B branch.
- Required GitHub checks pass.
- Independent review approves the pull request.
- Vercel monitoring activation evidence is recorded without secrets.
- No unresolved review thread, incident, or prohibited change remains.

## NEXT_REQUIRED_ACTION

Open the GOV-B pull request from `docs/gov-b-operational-governance` to protected `main`. Merge only after required CI and independent approval. Before declaring GOV-B complete, the deployment owner must record Vercel monitoring and active deployment evidence. Begin GOV-C only from updated `main` after these gates pass.

## Prohibited actions

- Do not create or edit migrations, RLS, policies, cron, or workers under GOV-B.
- Do not expose service-role credentials or write directly to database tables.
- Do not modify or deploy the public Relax Fix UAE site.
- Do not enable publishing, chatbot automation, external delivery, or destructive rollback merely to test governance documentation.
- Do not claim Vercel account-level monitoring is active without deployment-owner evidence.