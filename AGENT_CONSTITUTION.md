# AGENT CONSTITUTION

Document status: CURRENT-CANDIDATE
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Supersedes: none
Superseded by: none
Owner: Repository Owner

## 1. Binding safety boundary

This constitution governs all human, AI-agent, automation, reviewer, and tool activity in this repository. When instructions conflict, the stricter safety boundary applies until the conflict is resolved in writing.

## 2. Project separation

`command-center-hub` is an internal operations application. It is separate from `aymanmahrous/swim-fluent-uae`, the Relax Fix UAE public website, and from any paused mobile application. No credential, database assumption, deployment state, feature status, or evidence may be transferred between projects without explicit documented authorization.

## 3. Phase naming

Two namespaces are mandatory:

- Governance phases: `GOV-A` through `GOV-H`.
- Product phases: `PRODUCT-*`, with descriptive names rather than bare numbers.

The phrase `Phase 3` alone is prohibited because it previously referred to different workstreams. Any future work must use an unambiguous name such as `PRODUCT-CONTENT-BRAIN-VALIDATION` or `PRODUCT-SEO-READINESS`.

## 4. Git and review discipline

- Never push directly to `main`.
- Never auto-merge.
- Use one small branch and one Draft PR per governance or product scope.
- Do not mix migrations, runtime features, governance, evidence, or Production operations in one PR.
- Required checks and an independent review must pass before merge.
- Published history must not be force-pushed or rewritten.

## 5. Protected actions

Explicit human authorization is required before any merge, Production deployment, Production write, database migration, secret or environment change, external message, publishing action, provider call, billing action, or irreversible operation.

## 6. Data and credentials

- Never expose service-role or privileged credentials in browser code.
- Browser writes may use only approved, role-gated RPC or API contracts.
- No direct-table write is permitted from the browser.
- Real sensitive data must not be copied into logs, Issues, PRs, screenshots, fixtures, or AI-provider prompts.

## 7. Evidence taxonomy

Reports must distinguish: planned, documented, implemented, source-reviewed, contract-tested, CI-tested, Preview-tested, Production-deployed, Production-verified, and not verified.

## 8. Document taxonomy

Every current governance or operational document must declare one status: `CURRENT`, `DRAFT`, `BLOCKED`, `HISTORICAL`, or `SUPERSEDED`. Historical and superseded documents must not contain an executable `NEXT_REQUIRED_ACTION`.

## 9. Completion

A stage is complete only when its scoped changes, exclusions, evidence, review state, open risks, rollback boundary, and updated `PROJECT_HANDOFF.md` are recorded. A plan, branch, commit, or PR alone is not completion.

## 10. Current authorization

This branch is governance-only. It authorizes no scripts, Workflows, builds, tests, Preview, deployment, migration, Supabase access, AI-provider access, publishing, generation, or Production activity.