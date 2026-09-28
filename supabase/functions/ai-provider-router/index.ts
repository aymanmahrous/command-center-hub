import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
const OPENAI_API_KEY = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
const ALLOWED_ROLES = new Set(["super_admin", "admin", "content_manager"]);
const PROVIDERS = {
  gemini: { envVar: "GEMINI_API_KEY", label: "Gemini" },
  openai: { envVar: "OPENAI_API_KEY", label: "OpenAI" },
} as const;
type Provider = keyof typeof PROVIDERS;

type JsonObject = Record<string, unknown>;
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

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

function providerStatus(provider: Provider) {
  const definition = PROVIDERS[provider];
  const configured = provider === "gemini" ? Boolean(GEMINI_API_KEY) : Boolean(OPENAI_API_KEY);
  return {
    provider,
    label: definition.label,
    configured,
    status: configured ? "AVAILABLE" : "NOT_CONFIGURED",
    detail: configured
      ? `${definition.label} server-side credential is available.`
      : `Set ${definition.envVar} in Supabase Edge Function secrets (server-side only).`,
    credentialEnvVar: definition.envVar,
  };
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ success: false, code: "SERVER_MISCONFIGURED" }, 500);

  const token = bearerToken(request);
  if (!token) return json({ success: false, code: "AUTH_REQUIRED" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const staff = await requireStaff(supabase, token);
  if ("error" in staff && staff.error) return staff.error;

  const body = await request.json().catch(() => ({})) as JsonObject;
  const statuses = (Object.keys(PROVIDERS) as Provider[]).map(providerStatus);
  if (body.mode === "status") {
    return json({ success: true, providers: statuses });
  }

  if (body.mode !== "select" || (body.provider !== "gemini" && body.provider !== "openai")) {
    return json({ success: false, code: "INVALID_PROVIDER" }, 400);
  }
  const selected = providerStatus(body.provider);
  if (!selected.configured) {
    return json({ success: false, code: "PROVIDER_NOT_CONFIGURED", provider: selected.provider, detail: selected.detail, credentialEnvVar: selected.credentialEnvVar }, 424);
  }
  return json({ success: true, provider: selected.provider, status: selected.status, detail: selected.detail });
});
