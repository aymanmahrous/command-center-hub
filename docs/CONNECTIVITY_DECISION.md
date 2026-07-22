# Connectivity decision

The standalone browser app may use only the Supabase project URL and the active publishable key. These are public client identifiers and are not server secrets. Environment variables still override the committed browser-safe defaults.

The application must remain fail-closed when configuration is invalid. No service-role key, database password, webhook secret, scheduler secret, provider token, or other server credential may be committed or exposed to the browser.
