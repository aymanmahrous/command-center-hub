# Owner Administration — Fresh Production Authorization Check

**Checked:** 2026-11-07  
**Target:** the sole remaining Supabase project, `nmzxrjdxvmmzzmajrskm` (ACTIVE_HEALTHY, eu-west-1).  
**Method:** read-only catalog, schema, policy, function-definition, and row-count queries. No RPCs were invoked.

## 1. Project topology

The Supabase project listing returned exactly one project: `nmzxrjdxvmmzzmajrskm`. The former Bolt project is no longer present in the account's project list. This check does not infer anything about Vercel Preview configuration; it only confirms the current Supabase project inventory.

There is no separate QA database available in the current project list. Consequently, no role-switching or write-path runtime test can safely be performed against a second environment.

## 2. Current owner and audit data

- Active staff profiles: **1**.
- Active `super_admin` profiles: **1**.
- Other live staff roles: **0**.
- `audit_logs` rows: **1,115**.
- `staff_profiles` columns: `id`, `display_name`, `role`, `active`, `created_at`, `updated_at`.
- The app's five-role model remains `super_admin`, `admin`, `reception`, `coach`, `content_manager`; only `super_admin` is represented by a live active profile.

## 3. RLS and direct table access

- `staff_profiles`: RLS enabled; the only observed policy permits an authenticated user to SELECT their own active row (`id = auth.uid()` and `active = true`). No direct insert/update/delete policy exists.
- `audit_logs`: RLS enabled; no direct table policy exists.
- `business_settings`: RLS enabled; one public SELECT policy is limited to `id = 'primary'`. No update policy exists.
- `rf_schedule_config`, `notification_settings`, and legacy `settings`: no direct policies were returned in the focused policy inventory.
- Do not add broad table policies to make these tables directly readable. The existing pattern intentionally relies on guarded server functions for private operational data.

## 4. SECURITY DEFINER inventory — current live snapshot

The current catalog query returned:
- **81** SECURITY DEFINER functions executable by `authenticated`.
- **2** SECURITY DEFINER functions executable by `anon`.
- Among the 81 authenticated-executable functions, a source-marker classification found **55** containing `is_active_staff`, **22** containing `command_center_staff_role`, and **2** helper functions using a direct active-profile / `auth.uid()` check.
- The two anon-executable functions are `rf_schedule_turn` and `rf_whatsapp_automation_enabled`. Their inspected bodies are availability/configuration oriented. `rf_schedule_turn` returns `canConfirmSlot=false` and `bookingWriteUsed=false`; it does not write a booking.
- These counts classify visible guard patterns, not the minimum role allowlist of every RPC. A per-function role/action/caller matrix remains necessary before exposing additional administrative controls.

## 5. Confirmed owner-administration gaps

A targeted search of live public function definitions and schema found no dedicated function for:
- inviting/creating a staff Auth user;
- changing a staff profile's role;
- deactivating a staff profile;
- listing the full staff roster for an owner UI;
- reading/paginating `audit_logs` through a dedicated owner-only RPC.

The table and role constraint exist, but they do not constitute a safe owner-facing staff-management feature. The audit table contains history, but the application has no verified owner-facing audit reader and the table has no direct SELECT policy.

The existing `business_settings` table is the correct source for academy profile/booking settings; it is publicly readable for the primary row, but no owner update RPC/policy was found in this focused inventory. Do not create a second settings table or repurpose legacy `settings`.

## 6. Decisions and next safe implementation boundary

1. Do not build staff invitation, role editing, deactivation, or audit browsing UI against direct table access.
2. Do not add a new database, role table, permission table, feature-flag table, or duplicate settings system.
3. First complete the per-function authorization matrix, including exact role allowlists, read/write effect, audit behavior, and frontend caller for the existing 81 authenticated-executable SECURITY DEFINER functions. The current source-marker counts alone are not sufficient.
4. After that review, propose the smallest server-side contract for owner-only staff administration and paginated audit reading. It must enforce an active `super_admin` from the verified JWT inside the database function, audit every mutation, prevent self-lockout, and prevent disabling the last active super_admin.
5. Auth invitation/create-user requires a verified server-side Auth Admin path; do not expose a service-role key or claim the current client-only integration can safely invite users.
6. Production Supabase changes remain protected. No migration, function, grant, RLS, data, Auth, secret, or Edge Function change was made during this check.

## Verification boundary

This is a fresh read-only Production snapshot, not a role-behavior test. The only active role is `super_admin`, so the four other application roles cannot be runtime-verified here. The lack of a second Supabase project prevents isolated database QA. No production or external side effect was triggered.
