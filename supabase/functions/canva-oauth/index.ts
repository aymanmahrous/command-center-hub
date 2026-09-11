import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CANVA_CLIENT_ID = (Deno.env.get("CANVA_CLIENT_ID") ?? "").trim();
const CANVA_CLIENT_SECRET = (Deno.env.get("CANVA_CLIENT_SECRET") ?? "").trim();
const CANVA_REDIRECT_URI = (Deno.env.get("CANVA_REDIRECT_URI") ?? `${SUPABASE_URL}/functions/v1/canva-oauth?action=callback`).trim();
const COMMAND_CENTER_RETURN_URL = (Deno.env.get("COMMAND_CENTER_RETURN_URL") ?? "https://command-center-hub-lilac.vercel.app").replace(/\/$/, "");
const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const CANVA_SCOPES = "profile:read design:meta:read design:content:read";
const ALLOWED_ROLES = new Set(["super_admin", "admin", "content_manager"]);
const STATE_TTL_MS = 15 * 60 * 1000;
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function json(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function credentialsConfigured() {
  return Boolean(CANVA_CLIENT_ID && CANVA_CLIENT_SECRET && CANVA_REDIRECT_URI);
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function basicAuthHeader() {
  return `Basic ${btoa(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`)}`;
}

async function requireStaff(supabase: ReturnType<typeof createClient>, token: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { error: json({ success: false, code: "AUTH_REQUIRED" }, 401) };

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("id, role, active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile?.active || !ALLOWED_ROLES.has(String(profile.role))) {
    return { error: json({ success: false, code: "STAFF_ACCESS_DENIED" }, 403) };
  }
  return { staffId: authData.user.id };
}

async function cleanupExpiredStates(supabase: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  await supabase.from("staff_canva_oauth_states").delete().lt("created_at", cutoff);
}

function returnRedirect(params: Record<string, string>, status = 302) {
  const url = new URL(COMMAND_CENTER_RETURN_URL);
  url.searchParams.set("section", "content");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), status);
}

async function exchangeAuthorizationCode(code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: CANVA_REDIRECT_URI,
  });
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) return { error: "TOKEN_EXCHANGE_FAILED", status: response.status };
  const payload = await response.json().catch(() => null) as JsonObject | null;
  if (!payload || typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") {
    return { error: "TOKEN_RESPONSE_INVALID" };
  }
  const expiresIn = Number(payload.expires_in ?? 0);
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    scopes: String(payload.scope ?? CANVA_SCOPES),
    expiresAt: new Date(Date.now() + Math.max(expiresIn, 60) * 1000).toISOString(),
  };
}

async function handleCallback(request: Request, supabase: ReturnType<typeof createClient>) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return returnRedirect({ canva: "error", canva_code: error });

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !state) return returnRedirect({ canva: "error", canva_code: "INVALID_CALLBACK" });

  const { data: pending, error: pendingError } = await supabase
    .from("staff_canva_oauth_states")
    .select("staff_id, code_verifier, created_at")
    .eq("state", state)
    .maybeSingle();
  if (pendingError || !pending) return returnRedirect({ canva: "error", canva_code: "STATE_NOT_FOUND" });

  const createdAt = new Date(String(pending.created_at)).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > STATE_TTL_MS) {
    await supabase.from("staff_canva_oauth_states").delete().eq("state", state);
    return returnRedirect({ canva: "error", canva_code: "STATE_EXPIRED" });
  }

  const exchanged = await exchangeAuthorizationCode(code, String(pending.code_verifier));
  if ("error" in exchanged) {
    await supabase.from("staff_canva_oauth_states").delete().eq("state", state);
    return returnRedirect({ canva: "error", canva_code: exchanged.error });
  }

  const { error: upsertError } = await supabase.from("staff_canva_tokens").upsert({
    staff_id: pending.staff_id,
    access_token: exchanged.accessToken,
    refresh_token: exchanged.refreshToken,
    expires_at: exchanged.expiresAt,
    scopes: exchanged.scopes,
    updated_at: new Date().toISOString(),
  });
  await supabase.from("staff_canva_oauth_states").delete().eq("state", state);
  if (upsertError) return returnRedirect({ canva: "error", canva_code: "TOKEN_STORE_FAILED" });

  return returnRedirect({ canva: "connected" });
}

async function handleStatus(supabase: ReturnType<typeof createClient>, staffId: string) {
  if (!credentialsConfigured()) {
    return json({
      success: true,
      connected: false,
      integrationStatus: "NOT CONNECTED",
      credentialsConfigured: false,
      detail: "Canva OAuth credentials missing in Edge Function secrets.",
      openUrl: "https://www.canva.com/",
    });
  }

  const { data, error } = await supabase
    .from("staff_canva_tokens")
    .select("staff_id, expires_at, refresh_token")
    .eq("staff_id", staffId)
    .maybeSingle();
  if (error) return json({ success: false, code: "STATUS_UNAVAILABLE" }, 500);

  const connected = Boolean(data?.refresh_token);
  return json({
    success: true,
    connected,
    integrationStatus: connected ? "CONNECTED" : "NOT CONNECTED",
    credentialsConfigured: true,
    detail: connected
      ? "Canva OAuth connected for this staff account."
      : "Canva optional — connect OAuth to enable future design workflows.",
    openUrl: "https://www.canva.com/",
  });
}

async function handleAuthorize(supabase: ReturnType<typeof createClient>, staffId: string) {
  if (!credentialsConfigured()) {
    return json({
      success: false,
      code: "NEEDS_CREDENTIAL",
      credentialEnvVars: ["CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET"],
    }, 424);
  }

  await cleanupExpiredStates(supabase);
  const state = randomBase64Url(48);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = await pkceChallenge(codeVerifier);
  const { error: insertError } = await supabase.from("staff_canva_oauth_states").insert({
    state,
    staff_id: staffId,
    code_verifier: codeVerifier,
  });
  if (insertError) return json({ success: false, code: "STATE_STORE_FAILED" }, 500);

  const authorizeUrl = new URL(CANVA_AUTH_URL);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("scope", CANVA_SCOPES);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", CANVA_CLIENT_ID);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("redirect_uri", CANVA_REDIRECT_URI);

  return json({
    success: true,
    authorizationUrl: authorizeUrl.toString(),
    redirectUri: CANVA_REDIRECT_URI,
    scopes: CANVA_SCOPES,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ success: false, code: "SERVER_MISCONFIGURED" }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const url = new URL(request.url);

  if (request.method === "GET" && url.searchParams.get("action") === "callback") {
    return handleCallback(request, supabase);
  }

  if (request.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const token = bearerToken(request);
  if (!token) return json({ success: false, code: "AUTH_REQUIRED" }, 401);
  const staff = await requireStaff(supabase, token);
  if ("error" in staff && staff.error) return staff.error;

  const body = await request.json().catch(() => ({})) as JsonObject;
  if (body.mode === "status") return handleStatus(supabase, staff.staffId!);
  if (body.mode === "authorize") return handleAuthorize(supabase, staff.staffId!);

  return json({ success: false, code: "INVALID_INPUT" }, 400);
});
