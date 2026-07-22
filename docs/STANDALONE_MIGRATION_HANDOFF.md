# Standalone Command Center Migration Handoff

## Status

- Target repository: `aymanmahrous/command-center-hub` (private)
- Working branch: `migration/standalone-command-center`
- Public production repository: `aymanmahrous/swim-fluent-uae`
- Public production deployment: unchanged
- Database migrations: not executed
- External messages or publishing: not executed

## Completed and fixed

1. A standalone Vite + React + TypeScript application baseline was created.
2. The application is independent of the public website router and public pages.
3. All internal sections are represented in the standalone navigation:
   - Command Center
   - AI Inbox
   - CRM
   - Automations
   - AI Content Studio
   - 30-Day Planner
   - Media Library
   - Analytics
   - Integrations
4. Authentication uses Supabase password authentication with the public anon key.
5. Authorization requires exactly one active staff profile with an approved role.
6. The password is never persisted; only the access token and validated display metadata are held in `sessionStorage`.
7. Missing or invalid environment configuration fails closed.
8. The current baseline is read-only and performs no mutation, migration, seed, cron, worker, publishing, email, WhatsApp, or external notification.
9. Search indexing is blocked in HTML and deployment headers.
10. Security headers and a restrictive CSP are declared in `vercel.json`.
11. Secrets and generated output are excluded through `.gitignore`.
12. CI verifies TypeScript, security-contract tests, and the production build.

## Environment contract

Only these browser-safe variables are accepted:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STAFF_PROFILE_TABLE`

Never place a Supabase service-role key or any server secret in a `VITE_*` variable.

## Required Supabase contract

The configured staff profile table must be protected by Row Level Security and expose only the authenticated user's own row. Required fields:

- `user_id` UUID
- `display_name` text
- `role`: one of `super_admin`, `admin`, `reception`, `coach`, `content_manager`
- `active` boolean

## Current safe boundary

The baseline intentionally stops before operational data adapters and write actions. This is a security boundary, not an incomplete hidden write path. Subsequent feature transfers must be introduced one module at a time with:

1. documented table/API contract,
2. least-privilege RLS verification,
3. read-only test first,
4. explicit approval before enabling any write,
5. rollback note and handoff update.

## Rollback

No merge or deployment is required to roll back this work. Close the pull request or delete the working branch. The public production website remains unaffected.
