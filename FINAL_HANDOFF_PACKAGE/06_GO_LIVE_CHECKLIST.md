# Go-Live Checklist

Items outstanding before full go-live, as recorded in project governance documentation at the latest confirmed state. Nothing below reopens completed work.

## Public website

- [ ] PR #220 (documentation sync) — merge decision — PENDING OWNER/manager
- [ ] PR #213 (PWA) — rebase onto current `main`, fresh CI, Preview review, rollback re-check, then merge decision — PENDING OWNER approval for merge/Production promotion
- [ ] PR #143 (chatbot) — review and merge/Production-promotion decision — PENDING OWNER
- [ ] PR #36 (International Phone) — currently blocked/unusable; rebuild-or-drop decision — PENDING OWNER/manager
- [ ] Local SEO business facts confirmation (address, hours, categories, service areas, phone) — PENDING OWNER
- [ ] Privacy/Consent factual and legal acceptance — PENDING OWNER
- [ ] Analytics (GA4) production activation policy — PENDING OWNER
- [ ] Facebook/Instagram/Meta Business ownership and credential custody — PENDING OWNER
- [ ] Lead Operations data/consent/retention/handoff approval — PENDING OWNER
- [ ] Organic Pilot channels, success criteria, stop rules — PENDING OWNER
- [ ] Paid acquisition budget and stop-loss rules — PENDING OWNER
- [ ] Replit protected-integration scope — PENDING OWNER

## Internal tool (Command Center Hub)

- [ ] Documentation Review — open and merge its pull request
- [ ] Release Readiness Review — begin after Documentation Review merges
- [ ] Resolve `npm ci` vs `npm install` deployment-config discrepancy — PENDING OWNER/manager decision
- [ ] Execute the one authorized Facebook publish and record the receipt (Post ID, link, timestamp, execution ID) — authorization already granted, execution is the next action
- [ ] Independently confirm Production environment values, Supabase Auth settings, RLS/policies, and Vercel deployment protection

## Shared pre-launch items

- [ ] Resolve any Vercel account build-rate-limit constraint
- [ ] Confirm Production environment values in Vercel and Supabase without exposing them
- [ ] Decide which feature flags to enable for go-live (all default off/fail-closed today)
- [ ] Authorize the go-live Production deployment — PENDING OWNER
- [ ] Post-deployment read-only smoke test and accessibility/performance/localization spot-check
- [ ] Authorize any required DB migration/seed after a backup/change review — PENDING OWNER
- [ ] Authorize provider connectivity and publishing tests with controlled test records only — PENDING OWNER

## Explicit rule

No merge to a protected branch, no Production promotion, no credential change, and no publishing/advertising/billing action occurs without the specific owner approval noted above.
