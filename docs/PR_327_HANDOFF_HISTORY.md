# PR #327 — Handoff History

This document preserves PR-specific governance and implementation history that should not be appended to the canonical project handoff. It is historical evidence, not a claim of runtime verification or release authorization.

## 33. PR #327 governance and isolated QA reconciliation — 2026-11-07

- The #327 branch's stale copies of `AGENTS.md` and `MASTER_PROJECT_HANDOFF.md` were reconciled against the current canonical `main` versions; the canonical `docs/AI_AGENT_GOVERNANCE_CHARTER.md` was added to the branch. This preserves the latest owner governance and current project evidence instead of allowing older branch documentation to replace it.
- PR #327 remains OPEN and DRAFT. No merge, production deployment, Supabase schema/data change, OAuth change, publishing action, or paid provider call was performed.
- GitHub Verify run #942 on head `ea4261af7500f16546a1e5a07877fc0701ebd690` passed dependency installation, typecheck, 402/402 tests, production build, and performance budget. The documentation reconciliation commits are newer than that tested head and require CI on the updated branch before they can be considered verified.
- Vercel has a READY Preview deployment for this branch, but it belongs to older commit `381fed6d6e324e07365a35ea08df8b9b9f3acd7c`, not the current #327 head. Current-head Preview remains blocked by the team's Hobby-plan build-rate limit; do not treat the older preview as validation of the current code and do not repeatedly retry builds.
- Supabase account inventory contains only the Production project `nmzxrjdxvmmzzmajrskm`. Its existing development branch `main` is reported as `MIGRATIONS_FAILED`; it is not a clean QA branch. A new Supabase branch is estimated at USD 0.01344/hour and would start without Production data. Do not create one until migration-history drift and the existing failed branch are reconciled, and the owner separately confirms the recurring cost.
- Safe next step: verify the documentation-only commits and inspect/reconcile the current #327 branch against latest `main` without merging or releasing. For runtime QA, first establish a clean, isolated Supabase test target and a Preview deployment built from the exact candidate commit.

## 34. Historical implementation detail retained for PR #327 — 2026-11-07

The consolidation branch's earlier handoff section recorded these implementation decisions and corrections. They are retained here so the canonical handoff sync does not discard useful technical history:

- Retained the shared owner AI-provider preference, read-only provider status checks, retryable-outage-only fallback, canonical Connections routing, and view-only treatment for frozen publish jobs.
- Added Coach Brain strategic/business planning guidance and truthful manual Canva, Gemini Pro, and Runway handoffs through the existing Factory review flow.
- Added the canonical Coach Brain → Factory task contract while preserving backward-compatible legacy fields/storage key, safe storage fallback, storage read-back verification before navigation, and malformed-handoff rejection.
- Preserved the existing ten-item Factory batch; the selected 1–45 day window controls spacing rather than creating one post per day.
- Kept Runway as a manual external handoff, not an API integration. Gemini Image API billing is separate from the Gemini Pro subscription.
- Corrected four issues during consolidation: removed the unsupported 60-day preset; capped custom duration at 45 days; corrected handoff normalization to preserve the valid 1–45 day range; and fixed the missing comma in the Coach Brain research prompt.
- These notes describe source-level implementation and intended behavior; they do not claim live provider execution, runtime Preview verification, publishing, or Production release.
