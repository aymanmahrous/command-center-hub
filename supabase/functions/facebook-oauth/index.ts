import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const META_APP_ID = "980385998373405";
const META_APP_SECRET = (Deno.env.get("META_APP_SECRET") ?? "").trim();
const FACEBOOK_PAGE_ID = "1164107840123575";
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/facebook-oauth`;
const HUB_ORIGIN = "https://hub.relaxfixuae.com";
const WWW_HUB_ORIGIN = "https://www.hub.relaxfixuae.com";
const RETURN_BASE = (Deno.env.get("COMMAND_CENTER_RETURN_URL") ?? `${HUB_ORIGIN}/`).trim();
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/command-center(?:-[a-z0-9-]+)?-swimmingayman-8492s-projects\.vercel\.app$/i;
function isAllowedOrigin(origin: string | null | undefined) {
  const value = (origin ?? "").trim();
  return value === HUB_ORIGIN || value === WWW_HUB_ORIGIN || PREVIEW_ORIGIN_PATTERN.test(value);
}
function safeOrigin(origin: string | null | undefined) {
  return isAllowedOrigin(origin) ? String(origin).trim() : HUB_ORIGIN;
}
function configuredReturnOrigin() {
  try {
    const candidate = new URL(RETURN_BASE);
    if (candidate.protocol === "https:" && isAllowedOrigin(candidate.origin)) return candidate.origin;
  } catch {
    // Fall back to the production hub if the configured return URL is malformed.
  }
  return HUB_ORIGIN;
}
const GRAPH_VERSION = "v26.0";
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const STATE_TABLE = "staff_canva_oauth_states";
const STATE_PREFIX = "facebook:";
const STATE_TTL_MS = 15 * 60 * 1000;
const REQUESTED_SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";
const ALLOWED_ROLES = new Set(["super_admin", "admin", "content_manager"]);
function corsHeaders(origin?: string | null) {
  return {
    "access-control-allow-origin": safeOrigin(origin ?? configuredReturnOrigin()),
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "content-type": "application/json; charset=utf-8",
  };
}

type JsonObject = Record<string, unknown>;
type SupabaseClient = ReturnType<typeof createClient>;

function json(body: JsonObject, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeOrigin(origin: string) {
  return btoa(origin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeOrigin(state: string) {
  const encoded = state.split(":")[1] ?? "";
  if (!encoded) return configuredReturnOrigin();
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    return safeOrigin(atob(padded));
  } catch {
    return configuredReturnOrigin();
  }
}

async function requireStaff(supabase: SupabaseClient, token: string, origin?: string | null) {
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { error: json({ success: false, code: "AUTH_REQUIRED" }, 401, origin) };

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("id, role, active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile?.active || !ALLOWED_ROLES.has(String(profile.role))) {
    return { error: json({ success: false, code: "STAFF_ACCESS_DENIED" }, 403, origin) };
  }
  return { staffId: authData.user.id };
}

function configured() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && META_APP_SECRET && FACEBOOK_PAGE_ID && CALLBACK_URL);
}

function returnRedirect(status: "connected" | "error", code?: string, origin?: string | null) {
  const target = new URL(`${safeOrigin(origin ?? configuredReturnOrigin())}/`);
  target.pathname = "/";
  target.hash = "";
  target.searchParams.set("section", "connections");
  target.searchParams.set("facebook", status);
  if (code) target.searchParams.set("facebook_code", code);
  else target.searchParams.delete("facebook_code");
  return Response.redirect(target.toString(), 302);
}

async function cleanupFacebookStates(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  await supabase.from(STATE_TABLE).delete().like("state", `${STATE_PREFIX}%`).lt("created_at", cutoff);
}

async function handleAuthorize(supabase: SupabaseClient, staffId: string, origin: string) {
  if (!configured()) return json({ success: false, code: "OAUTH_NOT_CONFIGURED" }, 503, origin);

  await cleanupFacebookStates(supabase);
  const state = `${STATE_PREFIX}${encodeOrigin(origin)}:${randomBase64Url(32)}`;
  // The existing shared OAuth-state table requires this field; Meta's web flow uses the stored one-time state instead of PKCE.
  const compatibilityVerifier = randomBase64Url(48);
  const { error: insertError } = await supabase.from(STATE_TABLE).insert({
    state,
    staff_id: staffId,
    code_verifier: compatibilityVerifier,
  });
  if (insertError) return json({ success: false, code: "STATE_STORE_FAILED" }, 500, origin);

  const authorization = new URL(AUTH_URL);
  authorization.searchParams.set("client_id", META_APP_ID);
  authorization.searchParams.set("redirect_uri", CALLBACK_URL);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("scope", REQUESTED_SCOPES);

  return json({ success: true, authorizationUrl: authorization.toString() });
}

async function consumeState(supabase: SupabaseClient, state: string) {
  if (!state.startsWith(STATE_PREFIX)) return null;
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .delete()
    .eq("state", state)
    .gte("created_at", cutoff)
    .select("staff_id")
    .maybeSingle();
  if (error || !data?.staff_id) return null;
  return { staffId: String(data.staff_id), origin: decodeOrigin(state) };
}

async function exchangeCode(code: string) {
  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("redirect_uri", CALLBACK_URL);
  url.searchParams.set("code", code);
  const response = await fetch(url.toString(), { method: "GET", redirect: "error" });
  const payload = await response.json().catch(() => null) as JsonObject | null;
  if (!response.ok || typeof payload?.access_token !== "string") {
    const error = payload?.error && typeof payload.error === "object" ? payload.error as JsonObject : {};
    console.error("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "token_exchange", httpStatus: response.status, metaCode: error.code ?? null, metaType: error.type ?? null, metaSubcode: error.error_subcode ?? null }));
    return null;
  }
  return { accessToken: payload.access_token, expiresIn: Number(payload.expires_in ?? 0) };
}

async function exchangeLongLivedToken(shortLivedToken: string) {
  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", shortLivedToken);
  const response = await fetch(url.toString(), { method: "GET", redirect: "error" });
  const payload = await response.json().catch(() => null) as JsonObject | null;
  if (!response.ok || typeof payload?.access_token !== "string") {
    const error = payload?.error && typeof payload.error === "object" ? payload.error as JsonObject : {};
    console.error("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "long_lived_exchange", httpStatus: response.status, metaCode: error.code ?? null, metaType: error.type ?? null, metaSubcode: error.error_subcode ?? null }));
    return null;
  }
  return { accessToken: payload.access_token, expiresIn: Number(payload.expires_in ?? 0) };
}

async function findConfiguredPage(userAccessToken: string) {
  // Meta's /me/accounts can return an empty list for Pages selected in the
  // Business Login dialog. Verify the configured Page directly instead.
  const url = new URL(`${GRAPH_URL}/${encodeURIComponent(FACEBOOK_PAGE_ID)}`);
  url.searchParams.set("fields", "id,name,access_token");
  url.searchParams.set("access_token", userAccessToken);
  const response = await fetch(url.toString(), { method: "GET", redirect: "error" });
  const payload = await response.json().catch(() => null) as JsonObject | null;
  if (!response.ok || typeof payload?.id !== "string" || typeof payload.access_token !== "string") {
    const error = payload?.error && typeof payload.error === "object" ? payload.error as JsonObject : {};
    console.error("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "page_lookup_direct", httpStatus: response.status, metaCode: error.code ?? null, metaType: error.type ?? null, metaSubcode: error.error_subcode ?? null, targetPageId: FACEBOOK_PAGE_ID }));
    return null;
  }
  return {
    id: payload.id,
    name: typeof payload.name === "string" ? payload.name.slice(0, 120) : "Facebook Page",
    accessToken: payload.access_token,
  };
}

async function findInstagramBusinessAccount(pageId: string, pageAccessToken: string) {
  const url = new URL(`${GRAPH_URL}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "instagram_business_account{id,username}");
  url.searchParams.set("access_token", pageAccessToken);
  const response = await fetch(url.toString(), { method: "GET", redirect: "error" });
  const payload = await response.json().catch(() => null) as JsonObject | null;
  if (!response.ok || !payload?.instagram_business_account || typeof payload.instagram_business_account !== "object") return null;
  const account = payload.instagram_business_account as JsonObject;
  if (typeof account.id !== "string") return null;
  return { id: account.id, username: typeof account.username === "string" ? account.username.slice(0, 120) : "Instagram Business" };
}

async function storePageCredential(
  supabase: SupabaseClient,
  staffId: string,
  page: { id: string; name: string; accessToken: string },
  instagram: { id: string; username: string } | null,
) {
  const { data: existing, error: readError } = await supabase
    .from("staff_integrations")
    .select("id, metadata")
    .eq("provider", "facebook")
    .maybeSingle();
  if (readError) return false;

  const previousMetadata = existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
    ? existing.metadata as Record<string, unknown>
    : {};
  const metadata = {
    ...previousMetadata,
    oauthProvider: "meta_facebook",
    facebookPageId: page.id,
    grantedScopes: REQUESTED_SCOPES,
    credentialType: "page_access_token",
    ...(instagram ? { instagramAccountId: instagram.id, instagramUsername: instagram.username } : {}),
  };
  const now = new Date().toISOString();
  const row = {
    provider: "facebook",
    connection_method: "oauth",
    status: "pending",
    display_name: "Facebook",
    account_label: page.name,
    secret_hint: "Meta OAuth credential stored",
    metadata,
    connected_by: staffId,
    connected_at: now,
    last_tested_at: null,
    last_error_code: null,
    updated_at: now,
  };
  const { data: integration, error: integrationError } = await supabase
    .from("staff_integrations")
    .upsert(row, { onConflict: "provider" })
    .select("id")
    .single();
  if (integrationError || !integration?.id) return false;

  const { error: secretError } = await supabase.from("staff_integration_secrets").upsert({
    integration_id: integration.id,
    secret_value: page.accessToken,
    updated_at: now,
    updated_by: staffId,
  }, { onConflict: "integration_id" });
  if (secretError) {
    await supabase.from("staff_integrations").update({
      status: "error",
      last_error_code: "CREDENTIAL_STORE_FAILED",
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id);
    return false;
  }

  const { error: statusError } = await supabase.from("staff_integrations").update({
    status: "needs_test",
    last_error_code: null,
    updated_at: new Date().toISOString(),
  }).eq("id", integration.id);
  if (statusError) return false;

  if (instagram) {
    const { data: instagramIntegration, error: instagramReadError } = await supabase
      .from("staff_integrations")
      .select("id, metadata")
      .eq("provider", "instagram")
      .maybeSingle();
    if (instagramReadError) return false;
    const previousInstagramMetadata = instagramIntegration?.metadata && typeof instagramIntegration.metadata === "object" && !Array.isArray(instagramIntegration.metadata)
      ? instagramIntegration.metadata as Record<string, unknown>
      : {};
    const instagramNow = new Date().toISOString();
    const instagramRow = {
      provider: "instagram",
      connection_method: "oauth",
      status: "needs_test",
      display_name: "Instagram",
      account_label: instagram.username,
      secret_hint: "Meta OAuth credential stored",
      metadata: {
        ...previousInstagramMetadata,
        oauthProvider: "meta_facebook",
        facebookPageId: page.id,
        instagramAccountId: instagram.id,
        credentialType: "page_access_token",
      },
      connected_by: staffId,
      connected_at: instagramNow,
      last_tested_at: null,
      last_error_code: null,
      updated_at: instagramNow,
    };
    const { data: instagramUpsert, error: instagramUpsertError } = await supabase
      .from("staff_integrations")
      .upsert(instagramRow, { onConflict: "provider" })
      .select("id")
      .single();
    if (instagramUpsertError || !instagramUpsert?.id) return false;
    const { error: instagramSecretError } = await supabase.from("staff_integration_secrets").upsert({
      integration_id: instagramUpsert.id,
      secret_value: page.accessToken,
      updated_at: instagramNow,
      updated_by: staffId,
    }, { onConflict: "integration_id" });
    if (instagramSecretError) return false;
  }

  // Keep an audit receipt without writing any OAuth code or token to the audit log.
  await supabase.from("audit_logs").insert({
    actor_id: staffId,
    actor_type: "user",
    action: "integration_connected",
    entity_type: "staff_integration",
    entity_id: integration.id,
    detail: { provider: "facebook", method: "oauth", accountLabel: page.name },
  });
  return true;
}

async function handleCallback(request: Request, supabase: SupabaseClient) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const consumed = await consumeState(supabase, state);
  if (!consumed) return returnRedirect("error", "STATE_INVALID_OR_EXPIRED");
  const staffId = consumed.staffId;
  const returnOrigin = consumed.origin;

  if (url.searchParams.has("error")) return returnRedirect("error", "AUTHORIZATION_DENIED", returnOrigin);
  const code = url.searchParams.get("code") ?? "";
  if (!code || !configured()) return returnRedirect("error", code ? "OAUTH_NOT_CONFIGURED" : "INVALID_CALLBACK", returnOrigin);

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("id, role, active")
    .eq("id", staffId)
    .maybeSingle();
  if (profileError || !profile?.active || !ALLOWED_ROLES.has(String(profile.role))) {
    return returnRedirect("error", "STAFF_ACCESS_DENIED", returnOrigin);
  }

  try {
    console.log("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "callback_authorized", staffId }));
    const shortLived = await exchangeCode(code);
    if (!shortLived) return returnRedirect("error", "TOKEN_EXCHANGE_FAILED", returnOrigin);
    console.log("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "code_exchanged", expiresIn: shortLived.expiresIn }));
    const longLived = await exchangeLongLivedToken(shortLived.accessToken);
    if (!longLived) return returnRedirect("error", "LONG_LIVED_TOKEN_EXCHANGE_FAILED", returnOrigin);
    console.log("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "long_lived_exchanged", expiresIn: longLived.expiresIn }));
    const page = await findConfiguredPage(longLived.accessToken);
    if (!page) return returnRedirect("error", "TARGET_PAGE_NOT_AVAILABLE", returnOrigin);
    console.log("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "target_page_found", pageId: page.id, pageName: page.name }));
    const instagram = await findInstagramBusinessAccount(page.id, page.accessToken);
    const stored = await storePageCredential(supabase, staffId, page, instagram);
    if (!stored) return returnRedirect("error", "CREDENTIAL_STORE_FAILED", returnOrigin);
    console.log("FACEBOOK_OAUTH_STAGE", JSON.stringify({ stage: "credential_stored", instagram: Boolean(instagram) }));
    return returnRedirect("connected", undefined, returnOrigin);
  } catch {
    return returnRedirect("error", "OAUTH_FLOW_FAILED", returnOrigin);
  }
}

Deno.serve(async (request) => {
  const origin = safeOrigin(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ success: false, code: "SERVER_MISCONFIGURED" }, 500, origin);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (request.method === "GET") return handleCallback(request, supabase);
  if (request.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405, origin);

  const token = bearerToken(request);
  if (!token) return json({ success: false, code: "AUTH_REQUIRED" }, 401, origin);
  const staff = await requireStaff(supabase, token, origin);
  if ("error" in staff && staff.error) return staff.error;

  const body = await request.json().catch(() => ({})) as JsonObject;
  if (body.mode !== "authorize") return json({ success: false, code: "INVALID_INPUT" }, 400, origin);
  return handleAuthorize(supabase, staff.staffId!, origin);
});
