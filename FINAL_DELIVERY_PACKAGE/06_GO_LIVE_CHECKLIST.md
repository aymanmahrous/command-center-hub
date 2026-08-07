# Go-Live Checklist

Consolidated from both repos' explicit gate documentation (Owner Decision Queue, Master Baseline, Production Readiness Report, PROJECT_STRATEGY_HANDOFF gates). Each item is checked only if a source document records it as done; otherwise it is open and, where it depends on owner input, marked `PENDING OWNER`.

## Public website — engineering gates

- [x] Booking-ingress and RBAC security hardening deployed to production (PR #205, #219).
- [x] Production domain live and resolving (`relaxfixuae.com`).
- [ ] PR #220 (documentation sync) — merge decision. **PENDING OWNER/manager.**
- [ ] PR #213 (PWA) — rebase, fresh CI, Preview review, rollback re-check, then merge decision. **PENDING OWNER approval for any merge/Production promotion.**
- [ ] PR #143 (chatbot) — review and merge/Production-promotion decision. **PENDING OWNER.**
- [ ] PR #36 (International Phone) — currently unusable; needs rebuild decision or formal drop. **PENDING OWNER/manager.**
- [ ] Leaked-password protection, RLS-no-policy review (33 tables), performance-advisor items — remediation decision.

## Public website — owner decision queue (ODQ)

- [ ] **ODQ-01** Verified Local SEO business facts (address, hours, categories, service areas, phone). **PENDING OWNER.**
- [ ] **ODQ-02** Privacy/Consent factual and legal acceptance. **PENDING OWNER.**
- [ ] **ODQ-03** Production Analytics (GA4) test and activation policy. **PENDING OWNER.**
- [ ] **ODQ-04** Facebook/Instagram/Meta Business ownership and credential custody. **PENDING OWNER.**
- [ ] **ODQ-05** Lead Operations data/consent/retention/handoff approval. **PENDING OWNER.**
- [ ] **ODQ-06** Organic Pilot channels, success criteria, and stop rules. **PENDING OWNER.**
- [ ] **ODQ-07** Paid acquisition budget and stop-loss rules. **PENDING OWNER.**
- [ ] **ODQ-08** Replit protected-integration scope. **PENDING OWNER.**

## Internal tool (Command Center Hub) gates

- [ ] Documentation Review — open its pull request and merge after CI passes.
- [ ] Release Readiness Review — begin after Documentation Review merges; confirm CI on every audit PR and confirm production-activation gates remain closed.
- [ ] Resolve `npm ci` vs `npm install` deployment-config discrepancy. **PENDING OWNER/manager decision on whether alignment is required.**
- [ ] Execute the one authorized Facebook publish and record Post ID, link, publish time, execution ID, receipt status. **Owner authorization already granted for this single post — execution is the next action.**
- [ ] Confirm Vercel Production environment values, Supabase Auth settings, RLS/policies, and Vercel deployment protection independently (not covered by prior reviews).

## Shared pre-launch items (Production Readiness Report)

- [ ] Resolve any Vercel account build-rate-limit constraint.
- [ ] Set/confirm Production environment values in Vercel and Supabase without exposing them.
- [ ] Decide which feature flags to enable for go-live (all default to off/fail-closed today).
- [ ] Authorize the actual go-live Production deployment. **PENDING OWNER.**
- [ ] Post-deployment smoke test (read-only), accessibility/performance/localization spot-check.
- [ ] Authorize any required DB migration/seed after a backup/change review. **PENDING OWNER.**
- [ ] Authorize provider connectivity and publishing tests using controlled test records only. **PENDING OWNER.**

## Explicit rule

No merge to a protected branch, no Production promotion, no credential change, and no publishing/advertising/billing action occurs without the specific owner approval noted above. This checklist does not authorize any of them — it only records what is outstanding.
