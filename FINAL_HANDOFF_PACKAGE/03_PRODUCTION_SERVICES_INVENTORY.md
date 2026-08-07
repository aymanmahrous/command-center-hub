# Production Services Inventory

The running services that make up production, as recorded at the latest confirmed state.

## Hosting / deployment

| Service | Detail |
|---|---|
| Vercel — public website (canonical) | Project `swim-fluent-uae-w532` (ID `prj_4wRrALwNzlU0msHb9pGOsExmNID0`), domains `relaxfixuae.com`, `www.relaxfixuae.com`, latest verified deployment `dpl_3snNe5kDzLoK28D2vPgbPaZcjnT7` (READY) |
| Vercel — public website (non-canonical, dormant) | Project `swim-fluent-uae` — kept, not deleted, pending a separate consolidation decision |
| Vercel — internal tool | `command-center-hub-lilac.vercel.app` (standalone deployment, no custom domain recorded) |
| Vercel — scheduled job | `/api/cron/content-automation`, daily 00:15 UTC |

## Data services

| Service | Detail |
|---|---|
| Supabase — active/shared database | `nmzxrjdxvmmzzmajrskm`, PostgreSQL 17, eu-west-1 — used by both the public website and the internal tool via approved RPCs only (no direct table writes) |
| Supabase — legacy (public website side) | `relaxfix-pro` — inactive |
| Supabase — legacy (internal tool side) | `aazhniddjvhuimlxxjfd` — inactive, must not be touched |

## Automation services

| Service | Detail |
|---|---|
| n8n — content approval/publishing workflow | `xNwYPSXQiUyzDSyZ`, built and running internally up to the owner-approval step |
| n8n — retired workflows | `7OVKtZ2TAZsrDIXc`, `Vj8Xh4UQ534LYist` (inactive) |

## Third-party integration services (configured, live status varies)

| Service | Status |
|---|---|
| Facebook Page publishing | Page ID `1164107840123575` — one approved post pending execution; not yet live-publishing |
| Instagram publishing | Account ID `17841439747493221` — not yet started (step 2 of the approved rollout sequence) |
| Google Calendar (booking operations) | Configured via the operational account; live status not independently reconfirmed in this handoff |
| Google Analytics (GA4) | Code present, feature-flagged **off**; not live |
| WhatsApp Business Cloud API | Not yet connected/live |
| Site chatbot | Built, feature-flagged **off** |
| AI providers (OpenAI, Gemini, Alibaba Model Studio) | Configured in environment; not confirmed production-live with a verified real call |
| TikTok | Future adapter only; not provisioned |

## Security/CI services

| Service | Detail |
|---|---|
| CI regression guard | Fails builds if any privileged Postgres function becomes anonymously executable |
| Supabase advisors | Last known open items: leaked-password protection disabled, 33 RLS-enabled-no-policy tables, 1 extension-in-public warning, 15 performance-advisor notices — not yet remediated |
