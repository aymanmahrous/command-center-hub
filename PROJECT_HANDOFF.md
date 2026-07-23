# Command Center Hub Project Handoff

Document status: CURRENT
Authority: OPERATIONAL
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)
Owner: Repository Owner
Historical baseline: `PROJECT_HANDOFF.md` at commit `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`

## Purpose

This is the current operational continuation source. Historical implementation and verification evidence remains dated evidence only. Governance completion never authorizes runtime or external execution without a separate explicit approval.

## Source-of-truth order

1. `AGENT_CONSTITUTION.md`.
2. `docs/governance/PHASE_NAMESPACE.md`.
3. This Handoff.
4. `docs/governance/GOV_E_READINESS_REPORT.md`.
5. `.github/workflows/verify.yml` and `.github/workflows/preview-readonly.yml`.
6. `docs/governance/GITHUB_RULESETS_DESIGN.md` and `GITHUB_ENVIRONMENTS_DESIGN.md`.
7. `docs/governance/WRITE_AND_WORKFLOW_REGISTRY.md` and `RISK_OWNERSHIP_MATRIX.md`.
8. `docs/governance/PR_REGISTRY.md`.
9. Historical evidence, which is never executable.

## Current governance stage

`GOV-E: COMPLETED — READY FOR GOV-F`

GOV-A established source truth, GOV-B organized PR risk, GOV-C inventoried sensitive operations, GOV-D designed GitHub enforcement, and GOV-E normalized branch-only CI. No Workflow or check was run or activated on `main`.

## GOV-E stable checks

The normalized check names are:

- `verify:source`;
- `verify:ci`;
- `verify:release`;
- `test:unit`;
- `test:security`;
- `test:contracts`;
- `test:e2e:preview`.

`test:integration:disposable` is reserved but not applicable because this repository contains no authorized disposable database integration path.

## Command Center CI changes

- `.github/workflows/verify.yml` now declares PR, manual, and `push` to `main` triggers.
- All referenced Actions use full commit SHAs.
- `package.json` exposes stable verification scripts while keeping `verify` as an alias to `verify:ci`.
- The existing consolidated test suite currently backs unit, security, and contract aliases; later physical suite separation must preserve these check names.
- `.github/workflows/preview-readonly.yml` is manual-only, requires an exact HTTPS URL and target SHA, uses no secrets, and exposes `test:e2e:preview`.

## Supply-chain job

The independent `supply-chain` job defines:

- `npm ci --ignore-scripts`;
- lockfile dry-run integrity;
- `npm audit --omit=dev`;
- version-pinned unused-package and license checks;
- CycloneDX SBOM generation and pinned artifact upload;
- rejection of Action references using `@v*`, `@main`, or `@master`.

These definitions were not executed during GOV-E.

## Verification levels

- Source verification: normal PR and push-to-main CI, no external write credentials.
- Disposable verification: not applicable and not authorized for this repository.
- Preview verification: manual `preview-readonly`, read-only response check.
- Production-readonly verification: not configured or authorized for Command Center.
- Production-write and AI-spend: prohibited.

## Earlier governance state

- PR #19 remains the documentation candidate and was not modified.
- PR #8 remains stale, requires revalidation, and is non-merge-ready.
- CODEOWNERS, Rulesets, Environment designs, operation registry, risk ownership, kill switches, and rollback procedures remain authoritative through their governance files.
- Rulesets, Branch Protection, required checks, CODEOWNERS enforcement, and Environments are not active on `main` merely because their designs exist on this branch.

## Safety and limitations

- No Workflow, test, audit, build, Preview, deployment, database/provider connection, Production action, PR metadata change, or `main` change occurred.
- Supply-chain and CI definitions require a later authorized run before successful check names can be observed and enforced.
- Do not activate Required Checks until their exact successful contexts are observed.

## Transition gate

GOV-E is complete as a branch-only CI-normalization stage. GOV-F may begin only under a separate explicit instruction.
