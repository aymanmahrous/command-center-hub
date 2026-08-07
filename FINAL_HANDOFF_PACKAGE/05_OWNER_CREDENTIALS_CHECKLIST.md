# Owner Credentials Checklist

Environment variables and secrets the owner is the custodian of, by name only — no values recorded here or anywhere in project documentation.

## Public website (swim-fluent-uae)

- [ ] `SUPABASE_SECRET_KEY` — PENDING OWNER confirmation of rotation/custody status
- [ ] `INTERNAL_WORKER_TOKEN`
- [ ] `CRON_SECRET`
- [ ] `GOOGLE_CALENDAR_CREDENTIALS_JSON`
- [ ] `N8N_TECHNICAL_ACCOUNT`
- [ ] `N8N_BOOKING_WEBHOOK_URL`
- [ ] `N8N_BOOKING_WEBHOOK_TOKEN`
- [ ] `OPENAI_API_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `ALIBABA_MODEL_STUDIO_API_KEY`
- [ ] `META_APP_ID`
- [ ] `META_APP_SECRET`
- [ ] `META_VERIFY_TOKEN`
- [ ] `META_PAGE_ACCESS_TOKEN`
- [ ] `META_PAGE_ID`
- [ ] `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- [ ] `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_ACCESS_TOKEN`
- [ ] `TIKTOK_CLIENT_KEY`
- [ ] `TIKTOK_CLIENT_SECRET`
- [ ] `VITE_GA4_MEASUREMENT_ID` — PENDING OWNER, no Measurement ID confirmed yet

## Internal tool (command-center-hub)

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_STAFF_PROFILE_TABLE`
- [ ] `VITE_PASSWORD_RESET_PATH`

## Confirmation status

- [x] Client-safe (`VITE_*` public) keys — documented as safe for browser exposure; server-only secrets never placed in `VITE_*` variables per project rule.
- [ ] Independent confirmation that all server-only secrets above are currently set with live, working values in the Vercel/Supabase production environment — **PENDING OWNER** (not verified as part of this handoff, per the no-inspection mandate).
- [ ] Secret rotation/ownership transfer plan, if the owner wants credentials re-issued under their own control post-handoff — **PENDING OWNER** decision.

## Rule in force

This checklist tracks which credentials exist and who is the intended custodian. It does not read, expose, or change any credential value.
