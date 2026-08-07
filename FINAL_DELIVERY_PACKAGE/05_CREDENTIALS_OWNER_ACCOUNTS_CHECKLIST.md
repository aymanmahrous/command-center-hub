# Credentials / Owner-Owned Accounts Checklist

Every account and credential that project governance records as owner-controlled, or that requires owner action to confirm/provision. Values are never listed here — names and status only. Anything not explicitly confirmed in project documentation is marked **PENDING OWNER**.

## Confirmed owner accounts

- [x] `swimmingayman@gmail.com` — n8n technical-management account; also the Supabase `super_admin` staff login ("Coach Ayman").
- [x] `relaxfix2026@gmail.com` — operational Google Calendar, booking, and notification account.
- [x] GitHub repository ownership — `aymanmahrous/swim-fluent-uae` and `aymanmahrous/command-center-hub` (owner has admin permission).
- [x] Vercel account/projects — `swim-fluent-uae-w532` (+ non-canonical `swim-fluent-uae`), and the Command Center Hub deployment.
- [x] Supabase project `nmzxrjdxvmmzzmajrskm` (shared by both apps).
- [x] Google Drive canonical media library ("Relax Fix Growth OS – Media Library").

## PENDING OWNER — not yet confirmed in documentation

- [ ] **Facebook, Instagram, and Meta Business Suite ownership/permissions/custodian** — explicitly listed as an unresolved decision (ODQ-04). No publishing/scheduling may proceed until this is confirmed.
- [ ] **Google Business Profile** — visible profile only; internal fields (hours, categories, service areas, address visibility) are unverified and require an authorized owner-side audit.
- [ ] **Google Search Console** — account evidence not yet provided.
- [ ] Custom production domain for the Command Center Hub, if one is intended (currently Vercel subdomain only).
- [ ] Replit account/app disposition — kept as a separate internal app; ownership/long-term role not finalized.
- [ ] WhatsApp Business Cloud API account and credentials (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`) — not yet live.
- [ ] TikTok developer account/credentials — future adapter only, not provisioned.
- [ ] AI provider accounts/keys (OpenAI, Gemini, Alibaba Model Studio) — present in configuration but not confirmed production-live with a verified real call.
- [ ] Google Ads and Meta Ads billing accounts, budget ceilings, and stop-loss rules.
- [ ] GA4 property / Measurement ID — code exists but disabled; no confirmed Measurement ID recorded.

## Environment variables requiring owner-supplied secrets (names only — no values recorded here or anywhere in this package)

**swim-fluent-uae:**
`SUPABASE_SECRET_KEY`, `INTERNAL_WORKER_TOKEN`, `CRON_SECRET`, `GOOGLE_CALENDAR_CREDENTIALS_JSON`, `N8N_TECHNICAL_ACCOUNT`, `N8N_BOOKING_WEBHOOK_URL`, `N8N_BOOKING_WEBHOOK_TOKEN`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ALIBABA_MODEL_STUDIO_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `VITE_GA4_MEASUREMENT_ID`.

**command-center-hub:**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_STAFF_PROFILE_TABLE`, `VITE_PASSWORD_RESET_PATH`.

## Rule in force

Per both repos' governance documents: **no credential, secret, or environment variable may be committed, exposed in documentation, or changed without explicit owner approval.** This checklist tracks custody/status only.
