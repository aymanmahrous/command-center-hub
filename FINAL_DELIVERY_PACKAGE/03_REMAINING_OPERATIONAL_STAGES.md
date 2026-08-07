# Remaining Operational Stages

These are the stages recorded as open, blocked, in Draft, or pending as of the latest confirmed state. Nothing here is new work invented for this package — every item is drawn from the project's own open-item tracking.

## Public website (swim-fluent-uae)

- **PR #220** (documentation-only synchronization) — Draft, awaiting a separate manager/owner merge decision.
- **PR #36** (International Phone Phase B) — blocked: `DO_NOT_REBASE_DO_NOT_MERGE`, 325 commits behind `main`. Would need to be rebuilt from current `main` if still wanted — treat as **not usable in its current form**.
- **PR #213** (PWA installability) — Draft. Android install/offline behavior is owner-attested only (witnessed, not screenshotted or independently verified). Needs: rebase onto current `main`, fresh CI, Preview review at the exact head, and rollback re-check before any merge.
- **PR #143** (chatbot) — open and mergeable, but not merged; no Production promotion without explicit owner approval.
- **PR #46** (Privacy/Consent copy) — Draft, pending owner/legal decisions.
- **Marketing/growth gates** — all `BLOCKED_PROTECTED_APPROVAL` pending owner decisions (see Section 5 / Owner Decision Queue): Analytics (GA4) production activation, publishing readiness, paid acquisition (Google Ads, Meta Ads), Organic Pilot.
- **30-day content plan** — only Batch A1 (Week 1) is approved and mapped; Days 2–30 remain drafts, not produced or scheduled.
- **Outstanding security follow-ups** (not blocking current production but not yet closed): leaked-password protection still disabled; 33 tables flagged RLS-enabled-with-no-policy pending access-model review; 1 extension-in-public warning; 15 performance-advisor notices.
- **Replit "Command Center" (legacy/separate track)** — paused, no acceptance evidence delivered; downstream phases blocked on it.

## Internal tool (command-center-hub)

- **Documentation Review** — local verification passed, but its own pull request has not yet been opened/merged.
- **Release Readiness Review** — not started; explicitly the next stage after Documentation Review merges.
- **First live Facebook publish** — approved but **not yet executed**. This is the single most concrete next action recorded in the project: execute the one authorized post, then record the Facebook Post ID, link, publish time, execution ID, and receipt status. If the outcome is ambiguous, escalate — do not retry automatically.
- **Deployment-config discrepancy** — CI uses `npm ci`, `vercel.json` still specifies `npm install`; recorded but unresolved, needs an explicit decision before any production-setting change.
- **Marketing rollout sequence** (approved order, currently at step 1 — do not skip or reorder):
  1. Facebook publishing (in progress — see above)
  2. Instagram publishing
  3. Approve and schedule Week 1 content
  4. Produce/approve media after text approval
  5. Live publishing with receipts
  6. GA4 / UTM / attribution / conversion tracking
  7. SEO / Local SEO
  8. Service/lead chatbot
  9. n8n alerts, follow-ups, reports
  10. Google Ads
  11. Meta Ads
- **Not yet independently verified**: RBAC, API behavior, write operations, and attribution paths beyond the authenticated UI (only the UI has been visually verified).
- **Future-phase assets flagged not-yet-ready** when their phase arrives: GA4 (code present, disabled, no confirmed Measurement ID), site chatbot (built, feature-flagged off), Supabase `conversations`/`leads`/`knowledge_entries` tables (structurally ready, 0 rows), no live WhatsApp/Messenger/Instagram Messaging connection yet.

## PENDING OWNER

Every item above that depends on an owner decision, approval, or account access is expanded with the specific decision needed in **Section 5 (Credentials/Owner Checklist)** and **Section 6 (Go-Live Checklist)** — marked `PENDING OWNER` there rather than repeated here.
