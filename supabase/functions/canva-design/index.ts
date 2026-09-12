import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CANVA_CLIENT_ID = (Deno.env.get("CANVA_CLIENT_ID") ?? "").trim();
const CANVA_CLIENT_SECRET = (Deno.env.get("CANVA_CLIENT_SECRET") ?? "").trim();
const CANVA_BRAND_TEMPLATE_ID = (Deno.env.get("CANVA_BRAND_TEMPLATE_ID") ?? "").trim();
const CANVA_SOURCE_DESIGN_ID = (Deno.env.get("CANVA_SOURCE_DESIGN_ID") ?? "").trim();
const CANVA_AUTOFILL_HEADLINE_FIELD = (Deno.env.get("CANVA_AUTOFILL_HEADLINE_FIELD") ?? "headline").trim();
const CANVA_AUTOFILL_BODY_FIELD = (Deno.env.get("CANVA_AUTOFILL_BODY_FIELD") ?? "body").trim();
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const CANVA_API_BASE = "https://api.canva.com/rest/v1";
const MEDIA_BUCKET = "relax-fix-media";
const ALLOWED_ROLES = new Set(["super_admin", "admin", "content_manager"]);
const POLL_MS = 1500;
const POLL_ATTEMPTS = 40;
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
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

function basicAuthHeader() {
  return `Basic ${btoa(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function autofillSourceConfigured() {
  return Boolean(CANVA_BRAND_TEMPLATE_ID || CANVA_SOURCE_DESIGN_ID);
}

function credentialsConfigured() {
  return Boolean(CANVA_CLIENT_ID && CANVA_CLIENT_SECRET && autofillSourceConfigured());
}

async function refreshCanvaAccessToken(supabase: ReturnType<typeof createClient>, staffId: string) {
  const { data, error } = await supabase
    .from("staff_canva_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("staff_id", staffId)
    .maybeSingle();
  if (error || !data?.refresh_token) return { error: "CANVA_NOT_CONNECTED" as const };

  const expiresAt = new Date(String(data.expires_at)).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000 && data.access_token) {
    return { accessToken: String(data.access_token) };
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: String(data.refresh_token),
  });
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) return { error: "CANVA_TOKEN_REFRESH_FAILED" as const };
  const payload = await response.json().catch(() => null) as JsonObject | null;
  if (!payload || typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") {
    return { error: "CANVA_TOKEN_RESPONSE_INVALID" as const };
  }
  const expiresIn = Number(payload.expires_in ?? 3600);
  const expiresAtIso = new Date(Date.now() + Math.max(expiresIn, 60) * 1000).toISOString();
  await supabase.from("staff_canva_tokens").upsert({
    staff_id: staffId,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: expiresAtIso,
    scopes: String(payload.scope ?? ""),
    updated_at: new Date().toISOString(),
  });
  return { accessToken: payload.access_token };
}

async function canvaFetch(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`${CANVA_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as JsonObject;
  return { ok: response.ok, status: response.status, payload };
}

async function pollAutofillJob(accessToken: string, jobId: string) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const { ok, payload } = await canvaFetch(accessToken, `/autofills/${jobId}`, { method: "GET" });
    if (!ok) return { error: "AUTOFILL_STATUS_FAILED" as const };
    const job = payload.job as JsonObject | undefined;
    const status = String(job?.status ?? "");
    if (status === "success") {
      const design = ((job?.result as JsonObject | undefined)?.design ?? null) as JsonObject | null;
      const designId = typeof design?.id === "string" ? design.id : "";
      if (!designId) return { error: "AUTOFILL_NO_DESIGN" as const };
      return { designId, designUrl: typeof design?.url === "string" ? design.url : null };
    }
    if (status === "failed") return { error: "AUTOFILL_FAILED" as const };
    await sleep(POLL_MS);
  }
  return { error: "AUTOFILL_TIMEOUT" as const };
}

async function pollExportJob(accessToken: string, exportId: string) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const { ok, payload } = await canvaFetch(accessToken, `/exports/${exportId}`, { method: "GET" });
    if (!ok) return { error: "EXPORT_STATUS_FAILED" as const };
    const job = payload.job as JsonObject | undefined;
    const status = String(job?.status ?? "");
    if (status === "success") {
      const urls = Array.isArray(job?.urls) ? job.urls.filter((url) => typeof url === "string") as string[] : [];
      if (!urls.length) return { error: "EXPORT_NO_URL" as const };
      return { downloadUrl: urls[0] };
    }
    if (status === "failed") return { error: "EXPORT_FAILED" as const };
    await sleep(POLL_MS);
  }
  return { error: "EXPORT_TIMEOUT" as const };
}

async function createAutofillDesign(accessToken: string, title: string, headline: string, body: string) {
  const data: JsonObject = {};
  data[CANVA_AUTOFILL_HEADLINE_FIELD] = { type: "text", text: headline.slice(0, 200) };
  data[CANVA_AUTOFILL_BODY_FIELD] = { type: "text", text: body.slice(0, 1200) };

  const requestBody = CANVA_BRAND_TEMPLATE_ID
    ? {
      type: "create_from_brand_template",
      brand_template_id: CANVA_BRAND_TEMPLATE_ID,
      title: title.slice(0, 120),
      data,
    }
    : {
      type: "create_from_design",
      design_id: CANVA_SOURCE_DESIGN_ID,
      title: title.slice(0, 120),
      data,
    };

  const { ok, payload } = await canvaFetch(accessToken, "/autofills", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
  if (!ok) return { error: "AUTOFILL_CREATE_FAILED" as const, detail: payload };
  const jobId = String((payload.job as JsonObject | undefined)?.id ?? "");
  if (!jobId) return { error: "AUTOFILL_JOB_MISSING" as const };
  return pollAutofillJob(accessToken, jobId);
}

async function exportDesignPng(accessToken: string, designId: string) {
  const { ok, payload } = await canvaFetch(accessToken, "/exports", {
    method: "POST",
    body: JSON.stringify({
      design_id: designId,
      format: { type: "png", export_quality: "regular" },
    }),
  });
  if (!ok) return { error: "EXPORT_CREATE_FAILED" as const };
  const exportId = String((payload.job as JsonObject | undefined)?.id ?? "");
  if (!exportId) return { error: "EXPORT_JOB_MISSING" as const };
  return pollExportJob(accessToken, exportId);
}

async function storeDesignForContentItem(
  serviceSupabase: ReturnType<typeof createClient>,
  staffId: string,
  contentItemId: string,
  downloadUrl: string,
  topic: string,
) {
  const imageResponse = await fetch(downloadUrl);
  if (!imageResponse.ok) return { error: "DESIGN_DOWNLOAD_FAILED" as const };
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  const storagePath = `${staffId}/${crypto.randomUUID()}.png`;

  const upload = await serviceSupabase.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (upload.error) return { error: "STORAGE_UPLOAD_FAILED" as const };

  const { data: assetRow, error: insertError } = await serviceSupabase
    .from("media_assets")
    .insert({
      created_by: staffId,
      asset_type: "image",
      source: "ai_generated",
      storage_path: storagePath,
      provider: "canva",
      prompt: topic,
      metadata: { source: "canva_autofill", topic, contentItemId },
      category: "swimming_business",
      media_status: "unclassified",
      ai_analysis_status: "not_started",
      publishability_status: "blocked",
      consent_status: "unknown",
      content_item_id: contentItemId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError || !assetRow?.id) return { error: "MEDIA_REGISTER_FAILED" as const };
  const mediaAssetId = String(assetRow.id);

  const { error: linkError } = await serviceSupabase
    .from("content_items")
    .update({
      media_asset_id: mediaAssetId,
      media_source: "ai_generated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentItemId);
  if (linkError) return { error: "CONTENT_LINK_FAILED" as const };

  await serviceSupabase
    .from("media_assets")
    .update({ content_item_id: contentItemId, updated_at: new Date().toISOString() })
    .eq("id", mediaAssetId);

  return { mediaAssetId, storagePath };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ success: false, code: "SERVER_MISCONFIGURED" }, 500);

  const token = bearerToken(request);
  if (!token) return json({ success: false, code: "AUTH_REQUIRED" }, 401);

  const serviceSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const staff = await requireStaff(serviceSupabase, token);
  if ("error" in staff && staff.error) return staff.error;

  const body = await request.json().catch(() => ({})) as JsonObject;

  if (body.mode === "status") {
    const tokenResult = await refreshCanvaAccessToken(serviceSupabase, staff.staffId!);
    return json({
      success: true,
      credentialsConfigured: credentialsConfigured(),
      canvaConnected: !("error" in tokenResult),
      brandTemplateConfigured: Boolean(CANVA_BRAND_TEMPLATE_ID),
      sourceDesignConfigured: Boolean(CANVA_SOURCE_DESIGN_ID),
      integrationStatus: credentialsConfigured() && !("error" in tokenResult)
        ? "READY"
        : "NOT READY",
      detail: !credentialsConfigured()
        ? "Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_BRAND_TEMPLATE_ID or CANVA_SOURCE_DESIGN_ID in Edge Function secrets."
        : !autofillSourceConfigured()
        ? "Set CANVA_BRAND_TEMPLATE_ID or CANVA_SOURCE_DESIGN_ID to your Swim Fluent Canva template/design."
        : ("error" in tokenResult)
        ? "Connect Canva OAuth in Media Library first."
        : "Canva design generation ready.",
    });
  }

  if (body.mode !== "generate") return json({ success: false, code: "INVALID_INPUT" }, 400);
  if (!credentialsConfigured()) return json({ success: false, code: "NEEDS_CREDENTIAL" }, 424);

  const contentItemId = typeof body.contentItemId === "string" ? body.contentItemId : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const hook = typeof body.hook === "string" ? body.hook.trim() : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(contentItemId) || !topic) {
    return json({ success: false, code: "INVALID_INPUT" }, 400);
  }

  const tokenResult = await refreshCanvaAccessToken(serviceSupabase, staff.staffId!);
  if ("error" in tokenResult) return json({ success: false, code: tokenResult.error }, 424);

  const autofill = await createAutofillDesign(
    tokenResult.accessToken,
    topic,
    hook || topic,
    caption || topic,
  );
  if ("error" in autofill) return json({ success: false, code: autofill.error }, 502);

  const exported = await exportDesignPng(tokenResult.accessToken, autofill.designId);
  if ("error" in exported) return json({ success: false, code: exported.error }, 502);

  const stored = await storeDesignForContentItem(
    serviceSupabase,
    staff.staffId!,
    contentItemId,
    exported.downloadUrl,
    topic,
  );
  if ("error" in stored) return json({ success: false, code: stored.error }, 500);

  return json({
    success: true,
    contentItemId,
    mediaAssetId: stored.mediaAssetId,
    storagePath: stored.storagePath,
    canvaDesignUrl: autofill.designUrl,
  });
});
