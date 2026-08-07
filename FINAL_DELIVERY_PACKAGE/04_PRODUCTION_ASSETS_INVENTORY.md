# Production Assets Inventory

Every platform asset explicitly recorded in project documentation. No values/secrets are included — only what the asset is and where it lives.

## Public website (swim-fluent-uae)

| Asset | Identifier |
|---|---|
| GitHub repository | `aymanmahrous/swim-fluent-uae` (default branch `main`) |
| Canonical Vercel project | `swim-fluent-uae-w532` (project ID `prj_4wRrALwNzlU0msHb9pGOsExmNID0`) |
| Non-canonical Vercel project (do not delete/repurpose without a decision) | `swim-fluent-uae` |
| Latest verified production deployment | `dpl_3snNe5kDzLoK28D2vPgbPaZcjnT7` (READY) |
| Production domains | `relaxfixuae.com`, `www.relaxfixuae.com` (confirmed resolving, HTTP 200) |
| Supabase — canonical active project | `nmzxrjdxvmmzzmajrskm` (PostgreSQL 17, eu-west-1, ACTIVE_HEALTHY) |
| Supabase — non-canonical legacy project | `relaxfix-pro` (INACTIVE, pending disposition decision) |
| Google Drive canonical media library | "Relax Fix Growth OS – Media Library" (12 bilingual folders) |
| Replit app (separate, internal, non-authoritative) | "Command Center Hub", replId `744ff594-34c9-410f-92d4-5287d6efdc41` |
| Scheduled job | Vercel cron `/api/cron/content-automation`, daily 00:15 UTC |

## Internal tool (command-center-hub)

| Asset | Identifier |
|---|---|
| GitHub repository | `aymanmahrous/command-center-hub` (default branch `main`) |
| Standalone deployment URL | `command-center-hub-lilac.vercel.app` |
| Custom production domain | Not recorded in any source document — **PENDING OWNER** to confirm if one exists or is intended |
| Supabase — active project (only one to use) | `nmzxrjdxvmmzzmajrskm` (same Supabase project as the public website) |
| Supabase — inactive project (must remain untouched) | `aazhniddjvhuimlxxjfd` |
| n8n — approved active workflow | `xNwYPSXQiUyzDSyZ` (built, running internally up to the owner-approval step) |
| n8n — old/inactive workflows (must remain inactive) | `7OVKtZ2TAZsrDIXc`, `Vj8Xh4UQ534LYist` |
| Facebook Page ID | `1164107840123575` |
| Instagram Account ID | `17841439747493221` |
| First approved (unpublished) content item | `content_item_id: 9cf29b08-aaa3-4278-80bc-08a4cf3bc381` |
| Mock/test record (never a production asset — do not use as readiness proof) | `test-content-0001` |

## Notes

- The two repos share one Supabase database instance/project (`nmzxrjdxvmmzzmajrskm`).
- No custom domain is documented for the Command Center Hub — it currently runs on the Vercel subdomain only.
