# Monitoring and Incident Runbook

## Required monitoring coverage

### Deployment and build

- Alert on failed production deployments and repeated preview failures.
- Retain the commit SHA, pull request, deployment ID, failure stage, and relevant sanitized log excerpt.
- Treat performance-budget failures as release blockers, not runtime incidents.

### Runtime

- Review Vercel runtime logs for unhandled exceptions, repeated 5xx responses, authentication failures, and provider/RPC timeouts.
- Track request latency by route or operation where the hosting plan exposes it.
- Track memory and function-duration anomalies where the hosting plan exposes them.
- Never log access tokens, refresh tokens, service-role keys, full credentials, or private media URLs.

### Application signals

- Session-expiry rate.
- RPC validation failures.
- Authorization denials.
- Conversation-mode write failures.
- Booking status write failures.
- Content edit or transition failures.
- Publishing duplicates, stalls, or provider failures when publishing becomes active.

## Vercel activation checklist

The deployment owner must complete these account-level actions in Vercel and record evidence without secrets:

- Confirm production deployment notifications are enabled for failures.
- Confirm runtime logs are available and retention is understood.
- Configure exception/error integration if the approved plan and provider support it.
- Configure latency and resource alerts where available.
- Confirm the team members who receive alerts.
- Record the active production deployment ID matching the approved release.

Repository documentation does not itself activate Vercel account settings. GOV-B remains operationally pending until the owner records completion of this checklist.

## Severity levels

| Severity | Definition | Initial response |
| --- | --- | --- |
| SEV-1 | Unsafe writes, credential exposure, widespread outage, unintended publishing | Activate kill switch, stop affected writes, notify owner immediately, consider rollback |
| SEV-2 | Primary workflow unavailable or repeated production exceptions | Contain affected feature, assess rollback, open incident record |
| SEV-3 | Degraded latency, isolated errors, non-critical build failure | Investigate, create issue, monitor trend |
| SEV-4 | Documentation, cosmetic, or low-risk operational defect | Schedule normal correction |

## First-response procedure

1. Record detection time, source, affected environment, commit, and deployment.
2. Classify severity.
3. Activate the narrowest kill switch that prevents further harm.
4. Preserve sanitized evidence before changing the deployment.
5. Compare against the known-good release and decide whether rollback is safer than a forward fix.
6. Verify recovery using non-destructive checks.
7. Record owner, result, remaining risk, and follow-up action.

## Non-destructive verification

After deployment or rollback, verify:

- Login and staff-profile validation.
- Dashboard and operational read paths.
- No unexpected 4xx/5xx spike.
- No secrets in browser output or logs.
- Performance budget passed in CI.
- Writes remain disabled unless explicitly included in the approved verification plan.

## Evidence template

- Date/time and timezone:
- Environment:
- Commit SHA:
- Deployment ID:
- Alert/log source:
- Severity:
- Affected capability:
- Kill switch used:
- Rollback target, if any:
- Verification performed:
- Outcome:
- Owner:
- Follow-up issue/PR: