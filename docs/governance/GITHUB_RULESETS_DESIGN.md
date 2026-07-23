# GitHub Rulesets Design

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

## Scope and truth boundary

This file is a branch-only design. It does not prove that Rulesets or Branch Protection are enabled on `main`. Activation requires a later explicit repository-settings action and a recorded settings receipt.

## Proposed `main` ruleset

| Control | Required design |
|---|---|
| Required pull request | Every change to `main` must arrive through a PR. Direct pushes are blocked. |
| Required approvals | Minimum 1 independent approving review; 2 for migrations, auth, AI, publishing, secrets, Production workflows, or governance authority files. |
| Code-owner review | Required for every path matched by `.github/CODEOWNERS`. |
| Dismiss stale approvals | Enabled when the head SHA changes. |
| Review after last push | Require approval from someone other than the last pusher after the latest push. |
| Required conversation resolution | All review threads and conversations must be resolved. |
| Required checks | `verify` initially; GOV-E must define stable source, supply-chain, typecheck, test and build check names before enforcement. |
| Force push | Blocked for all users and automation. |
| Branch deletion | Blocked. |
| Bypass | No routine bypass. Emergency bypass limited to Repository Owner plus Independent Repository Approver, with incident receipt and retrospective review. |
| Merge policy | Squash merge disabled for published governance evidence; use merge commit or rebase-free linear fast-forward policy consistently. Preferred policy: merge commit with protected PR history. |
| Linear history | Do not require linear history while merge commits are the audit-preserving policy. History rewriting, amend and force-push remain prohibited. |
| Signed commits | Recommended later; not a GOV-D completion blocker. |

## Sensitive-path escalation

Changes to workflows, migrations, auth, AI, booking, verification scripts, privacy documents, Constitution, Handoff, CODEOWNERS, and governance designs require Code Owner review and an independent approver who is not the author or operator.

## Emergency policy

Emergency bypass must be used only to contain an active incident. The bypass actor records reason, affected SHA, time, scope, rollback owner, and post-action verification. Bypass may not be used to avoid failing checks or missing approvals.

## Activation gate

Before enabling the ruleset, verify:

1. CODEOWNERS handles have repository access and independent-review capacity.
2. Required check names exist and are stable.
3. Admin enforcement and bypass actors are explicitly configured.
4. A screenshot or settings export records the active ruleset.
5. No existing protected workflow is unintentionally made impossible to operate.
