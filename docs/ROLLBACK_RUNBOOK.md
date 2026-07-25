# Rollback and Release Runbook

## Known-good baseline

- Stable baseline merge commit: `312c30b4662afdea33b8b6f3e6a4e44201ec4b1f`
- Source: merged PR #18
- Verification evidence: TypeScript, 33/33 tests, production build, and performance budget passed before merge.

The deployment owner must record the matching Vercel deployment identifier before GOV-B is declared complete.

## Release naming

Use annotated Git tags and GitHub Releases for approved operational baselines:

- Tag format: `command-center-vYYYY.MM.DD.N`
- Release title: `Command Center YYYY-MM-DD — N`
- Release notes must contain commit SHA, merged PRs, verification results, database impact, environment impact, deployment identifier, and rollback target.

Tags and releases must point to a commit already merged into protected `main`. Do not tag unreviewed branches as production releases.

## Rollback authority

| Action | Authorized role |
| --- | --- |
| Pause publishing or chatbot | Operations owner or incident commander |
| Roll back Vercel deployment | Deployment owner or repository owner |
| Revert a merged PR | Repository owner through a reviewed revert PR |
| Database rollback | Backend/data owner with explicit approval and backup evidence |
| Full runtime stop | Incident commander plus repository/deployment owner where available |

## Decision conditions

Rollback is appropriate when a newly deployed change causes one or more of the following:

- Authentication or authorization failure.
- Repeated production exceptions.
- Incorrect or unsafe writes.
- Publishing duplication or unintended external delivery.
- Material latency or resource regression.
- Broken primary operational flow with no safe narrow mitigation.

## Fast Vercel rollback

1. Declare the incident and identify the current and last known-good deployment.
2. Activate the narrowest applicable kill switch first.
3. Use Vercel deployment history to promote or redeploy the recorded known-good deployment.
4. Do not alter production environment values during rollback unless the incident is caused by configuration and the change is explicitly approved.
5. Verify login, dashboard load, read paths, and one non-destructive operational flow.
6. Record actor, timestamp, reason, old deployment, restored deployment, verification, and remaining risks.

## Git rollback

Prefer a revert pull request instead of rewriting history:

1. Create `revert/<incident-or-pr>` from current `main`.
2. Revert the offending merge commit.
3. Run `npm ci` and `npm run verify`.
4. Open a pull request with incident context and the exact rollback target.
5. Merge only after required checks and approval, unless the protected emergency process explicitly allows otherwise.
6. Create a new release after recovery; never move an existing production tag.

## Database rule

This frontend repository does not authorize destructive database rollback. Any migration, RLS, policy, RPC, or data correction requires the backend/data owner, a backup or restoration point, a reviewed plan, and post-action verification.

## Recovery completion

An incident is not closed until:

- The restored deployment is verified.
- Monitoring shows no repeated errors.
- All temporary kill switches are either safely retained with an owner or reversed.
- A corrective issue or pull request exists.
- The handoff and release record identify the active production commit and deployment.