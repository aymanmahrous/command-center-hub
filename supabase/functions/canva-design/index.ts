import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CANVA_CLIENT_ID = (Deno.env.get("CANVA_CLIENT_ID") ?? "").trim();
const CANVA_CLIENT_SECRET = (Deno.env.get("CANVA_CLIENT_SECRET") ?? "").trim();
const CANVA_BRAND_TEMPLATE_ID = (Deno.env.get("CANVA_BRAND_TEMPLATE_ID") ?? "EAHVAAahmjU").trim();
const CANVA_BRAND_TEMPLATE_IDS = (Deno.env.get("CANVA_BRAND_TEMPLATE_IDS") ?? CANVA_BRAND_TEMPLATE_ID)
  .split(",").map((id) => id.trim()).filter(Boolean);
const CANVA_SOURCE_DESIGN_ID = (Deno.env.get("CANVA_SOURCE_DESIGN_ID") ?? "DAHZBpiQ_H8").trim();
const CANVA_RECOVERED_SOURCE_DESIGN_ID = "DAHZBpiQ_H8";
const CANVA_AUTOFILL_HEADLINE_FIELD = (Deno.env.get("CANVA_AUTOFILL_HEADLINE_FIELD") ?? "hook").trim();
const CANVA_AUTOFILL_BODY_FIELD = (Deno.env.get("CANVA_AUTOFILL_BODY_FIELD") ?? "caption").trim();
const CANVA_AUTOFILL_WHATSAPP_FIELD = (Deno.env.get("CANVA_AUTOFILL_WHATSAPP_FIELD") ?? "whatsapp").trim();
const CANVA_AUTOFILL_PHONE_FIELD = (Deno.env.get("CANVA_AUTOFILL_PHONE_FIELD") ?? "phone").trim();
const RELAXFIX_WHATSAPP_LINE = "WhatsApp 058 821 9130 — messages & booking";
const RELAXFIX_PHONE_LINE = "Call 055 137 8660 — admin team (phone calls only)";
const RELAXFIX_ASSESSMENT_LINE = "Free initial assessment.";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const CANVA_REQUIRED_SCOPES = ["design:content:write", "asset:write"] as const;
const CANVA_API_BASE = "https://api.canva.com/rest/v1";
const MEDIA_BUCKET = "relax-fix-media";
const ALLOWED_ROLES = new Set(["super_admin", "admin", "content_manager"]);
const CONTENT_PUBLISHER_AUTOMATION_SECRET = Deno.env.get("CONTENT_PUBLISHER_AUTOMATION_SECRET") ?? "";
const POLL_MS = 1500;
const POLL_ATTEMPTS = 40;
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-content-publisher-automation-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function json(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
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
  return Boolean(CANVA_BRAND_TEMPLATE_IDS.length || CANVA_SOURCE_DESIGN_ID);
}

function chooseBrandTemplateId(contentItemId: string): string {
  if (CANVA_BRAND_TEMPLATE_IDS.length <= 1) return CANVA_BRAND_TEMPLATE_IDS[0] ?? "";
  // Stable per content item: the same item always uses the same template, while new items rotate.
  let hash = 0;
  for (const character of contentItemId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return CANVA_BRAND_TEMPLATE_IDS[hash % CANVA_BRAND_TEMPLATE_IDS.length];
}

function credentialsConfigured() {
  return Boolean(CANVA_CLIENT_ID && CANVA_CLIENT_SECRET && autofillSourceConfigured());
}

async function refreshCanvaAccessToken(supabase: ReturnType<typeof createClient>, staffId: string) {
  const { data, error } = await supabase
    .from("staff_canva_tokens")
    .select("access_token, refresh_token, expires_at, scopes")
    .eq("staff_id", staffId)
    .maybeSingle();
  if (error || !data?.refresh_token) return { error: "CANVA_NOT_CONNECTED" as const };

  const expiresAt = new Date(String(data.expires_at)).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000 && data.access_token) {
    return { accessToken: String(data.access_token), scopes: String(data.scopes ?? "") };
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
    scopes: String(payload.scope ?? data.scopes ?? ""),
    updated_at: new Date().toISOString(),
  });
  return { accessToken: payload.access_token, scopes: String(payload.scope ?? data.scopes ?? "") };
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

type CanvaDataset = Record<string, { type?: string }>;

function datasetFields(dataset: unknown, type: string): string[] {
  if (!dataset || typeof dataset !== "object") return [];
  return Object.entries(dataset as Record<string, unknown>).flatMap(([name, value]) =>
    value && typeof value === "object" && (value as JsonObject).type === type ? [name] : [],
  );
}

async function fetchDataset(accessToken: string, path: string) {
  const { ok, payload } = await canvaFetch(accessToken, path, { method: "GET" });
  const dataset = payload.dataset as CanvaDataset | undefined;
  if (!ok || !dataset || typeof dataset !== "object") return { error: "AUTOFILL_DATASET_EMPTY" as const };
  return { dataset };
}

function buildAutofillDataFromDataset(
  dataset: CanvaDataset,
  headline: string,
  body: string,
  imageAssetId?: string,
): JsonObject {
  const textFields = datasetFields(dataset, "text");
  const bodyWithContacts = /058 821 9130/.test(body) && /055 137 8660/.test(body)
    ? body
    : `${body}\n\n${RELAXFIX_WHATSAPP_LINE}\n${RELAXFIX_PHONE_LINE}\n${RELAXFIX_ASSESSMENT_LINE}`;
  const data: JsonObject = {};
  const headlineField = textFields.includes(CANVA_AUTOFILL_HEADLINE_FIELD)
    ? CANVA_AUTOFILL_HEADLINE_FIELD
    : textFields[0];
  const bodyField = textFields.includes(CANVA_AUTOFILL_BODY_FIELD)
    ? CANVA_AUTOFILL_BODY_FIELD
    : textFields.find((field) => field !== headlineField);
  if (headlineField && bodyField) {
    data[headlineField] = { type: "text", text: headline.slice(0, 200) };
    data[bodyField] = { type: "text", text: bodyWithContacts.slice(0, 1200) };
  } else if (headlineField) {
    data[headlineField] = { type: "text", text: `${headline}\n\n${bodyWithContacts}`.slice(0, 1200) };
  }
  if (imageAssetId) {
    const imageField = datasetFields(dataset, "image")[0];
    if (imageField) data[imageField] = { type: "image", asset_id: imageAssetId };
  }
  return data;
}

async function uploadLinkedImageToCanva(
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  contentItemId: string,
  requestedMediaAssetId: string,
) {
  // Only use the image currently linked to this content item; never accept arbitrary storage paths.
  const { data: contentItem, error: contentError } = await supabase
    .from("content_items")
    .select("id, media_asset_id")
    .eq("id", contentItemId)
    .maybeSingle();
  if (contentError) return { error: "CONTENT_ITEM_READ_FAILED" as const };
  if (!contentItem || String(contentItem.media_asset_id ?? "") !== requestedMediaAssetId) {
    return { error: "MEDIA_ASSET_NOT_LINKED" as const };
  }
  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select("id, asset_type, storage_path, publishability_status")
    .eq("id", requestedMediaAssetId)
    .maybeSingle();
  if (assetError) return { error: "MEDIA_ASSET_READ_FAILED" as const };
  if (!asset || String(asset.asset_type ?? "").toLowerCase() !== "image" || !asset.storage_path) {
    return { error: "IMAGE_ASSET_REQUIRED" as const };
  }
  if (String(asset.publishability_status ?? "") === "blocked") {
    return { error: "MEDIA_ASSET_NOT_PUBLISHABLE" as const };
  }
  const { data: file, error: downloadError } = await supabase.storage.from(MEDIA_BUCKET).download(String(asset.storage_path));
  if (downloadError || !file) return { error: "MEDIA_ASSET_DOWNLOAD_FAILED" as const };
  const mimeType = file.type.startsWith("image/") ? file.type : "image/png";
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const metadata = JSON.stringify({ name_base64: btoa(`coach-ayman-${contentItemId}.${extension}`) });
  const uploadResponse = await fetch(`${CANVA_API_BASE}/asset-uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": metadata,
    },
    body: new Uint8Array(await file.arrayBuffer()),
  });
  const uploadPayload = await uploadResponse.json().catch(() => ({})) as JsonObject;
  if (!uploadResponse.ok) return { error: "CANVA_IMAGE_UPLOAD_FAILED" as const };
  const jobId = String((uploadPayload.job as JsonObject | undefined)?.id ?? "");
  if (!jobId) return { error: "CANVA_IMAGE_UPLOAD_JOB_MISSING" as const };
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const { ok, payload } = await canvaFetch(accessToken, `/asset-uploads/${jobId}`, { method: "GET" });
    if (!ok) return { error: "CANVA_IMAGE_UPLOAD_STATUS_FAILED" as const };
    const job = payload.job as JsonObject | undefined;
    const status = String(job?.status ?? "");
    if (status === "success") {
      const uploadedAsset = job?.asset as JsonObject | undefined;
      const assetId = typeof uploadedAsset?.id === "string" ? uploadedAsset.id : "";
      return assetId ? { assetId } : { error: "CANVA_IMAGE_ASSET_MISSING" as const };
    }
    if (status === "failed") return { error: "CANVA_IMAGE_UPLOAD_FAILED" as const };
    await sleep(POLL_MS);
  }
  return { error: "CANVA_IMAGE_UPLOAD_TIMEOUT" as const };
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

async function createAutofillDesign(
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  contentItemId: string,
  title: string,
  headline: string,
  body: string,
  sourceMediaAssetId: string,
) {
  let selectedBrandTemplateId = chooseBrandTemplateId(contentItemId);
  let sourceDesignId = CANVA_SOURCE_DESIGN_ID;
  let datasetResult = selectedBrandTemplateId
    ? await fetchDataset(accessToken, `/brand-templates/${selectedBrandTemplateId}/dataset`)
    : { error: "AUTOFILL_DATASET_EMPTY" as const };
  // A stale/unavailable Brand Template must not block a valid, editable source design.
  if ("error" in datasetResult || datasetFields(datasetResult.dataset, "image").length === 0) {
    selectedBrandTemplateId = "";
    const sourceCandidates = [...new Set([CANVA_SOURCE_DESIGN_ID, CANVA_RECOVERED_SOURCE_DESIGN_ID].filter(Boolean))];
    let sourceResult: Awaited<ReturnType<typeof fetchDataset>> | null = null;
    for (const candidateId of sourceCandidates) {
      const candidate = await fetchDataset(accessToken, `/designs/${candidateId}/dataset`);
      if (!("error" in candidate) && datasetFields(candidate.dataset, "image").length > 0) {
        sourceResult = candidate;
        sourceDesignId = candidateId;
        break;
      }
      sourceResult = candidate;
    }
    if (!sourceResult || "error" in sourceResult || datasetFields(sourceResult.dataset, "image").length === 0) {
      return { error: "TEMPLATE_IMAGE_FIELD_MISSING" as const };
    }
    datasetResult = sourceResult;
  }
  const imageFields = datasetFields(datasetResult.dataset, "image");
  if (imageFields.length === 0) return { error: "TEMPLATE_IMAGE_FIELD_MISSING" as const };
  let uploadedImageAssetId = "";
  if (sourceMediaAssetId && imageFields.length > 0) {
    const uploaded = await uploadLinkedImageToCanva(accessToken, supabase, contentItemId, sourceMediaAssetId);
    if ("error" in uploaded) return uploaded;
    uploadedImageAssetId = uploaded.assetId;
  }
  const data = buildAutofillDataFromDataset(
    datasetResult.dataset,
    headline,
    body,
    uploadedImageAssetId || undefined,
  );
  const requestBody: JsonObject = selectedBrandTemplateId
    ? {
      type: "create_from_brand_template",
      brand_template_id: selectedBrandTemplateId,
      title: title.slice(0, 120),
      data,
    }
    : {
      type: "create_from_design",
      design_id: sourceDesignId,
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
  const completed = await pollAutofillJob(accessToken, jobId);
  if ("error" in completed) return completed;
  return { ...completed, imageApplied: Boolean(uploadedImageAssetId) };
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
  autonomous: boolean,
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
      metadata: {
        source: "canva_autofill",
        autonomous,
        topic,
        contentItemId,
        analysis: {
          synthetic: true,
          containsChildrenGuess: "no",
          containsPeopleGuess: "no",
          consentRequired: false,
          reviewRequired: true,
        },
        analysisProvider: "canva_generated",
      },
      category: "swimming_business",
      media_status: "unclassified",
      ai_analysis_status: "completed",
      publishability_status: "ready_for_review",
      consent_status: "consent_confirmed",
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

  const automationSecret = request.headers.get("x-content-publisher-automation-secret") ?? "";
  const automationMode = Boolean(
    CONTENT_PUBLISHER_AUTOMATION_SECRET &&
    automationSecret &&
    constantTimeEqual(automationSecret, CONTENT_PUBLISHER_AUTOMATION_SECRET),
  );

  const serviceSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let staffId = "";
  if (automationMode) {
    const { data: tokenRow, error: tokenError } = await serviceSupabase
      .from("staff_canva_tokens")
      .select("staff_id")
      .not("refresh_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tokenError || !tokenRow?.staff_id) return json({ success: false, code: "CANVA_NOT_CONNECTED" }, 424);
    staffId = String(tokenRow.staff_id);
  } else {
    const token = bearerToken(request);
    if (!token) return json({ success: false, code: "AUTH_REQUIRED" }, 401);
    const staff = await requireStaff(serviceSupabase, token);
    if ("error" in staff && staff.error) return staff.error;
    staffId = staff.staffId;
  }

  const body = await request.json().catch(() => ({})) as JsonObject;

  if (body.mode === "status") {
    const tokenResult = await refreshCanvaAccessToken(serviceSupabase, staffId);
    const missingScopes = "error" in tokenResult
      ? [...CANVA_REQUIRED_SCOPES]
      : CANVA_REQUIRED_SCOPES.filter((scope) => !tokenResult.scopes.split(/\s+/).includes(scope));
    const selectedBrandTemplateId = chooseBrandTemplateId("canva-status");
    const connected = !("error" in tokenResult);
    const templateResult = connected && selectedBrandTemplateId
      ? await fetchDataset(tokenResult.accessToken, `/brand-templates/${selectedBrandTemplateId}/dataset`)
      : { error: "AUTOFILL_DATASET_EMPTY" as const };
    let activeDataset: CanvaDataset | null = !("error" in templateResult) ? templateResult.dataset : null;
    let activeSource: "brand_template" | "design" | "none" = activeDataset && datasetFields(activeDataset, "image").length > 0
      ? "brand_template"
      : "none";
    if (connected && activeSource === "none") {
      for (const candidateId of [...new Set([CANVA_SOURCE_DESIGN_ID, CANVA_RECOVERED_SOURCE_DESIGN_ID].filter(Boolean))]) {
        const candidate = await fetchDataset(tokenResult.accessToken, `/designs/${candidateId}/dataset`);
        if (!("error" in candidate) && datasetFields(candidate.dataset, "image").length > 0) {
          activeDataset = candidate.dataset;
          activeSource = "design";
          break;
        }
      }
    }
    const imageFieldCount = datasetFields(activeDataset, "image").length;
    const textFieldCount = datasetFields(activeDataset, "text").length;
    const templateImageAutofillReady = imageFieldCount > 0;
    const fullyReady = credentialsConfigured() && connected && missingScopes.length === 0 && templateImageAutofillReady;
    const detail = !credentialsConfigured()
      ? "Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET in Edge Function secrets."
      : !connected
      ? "Reconnect Canva from Media Library; the saved OAuth token is missing or expired."
      : missingScopes.length > 0
      ? `Reconnect Canva to grant the missing permission(s): ${missingScopes.join(", ")}.`
      : activeSource === "design"
      ? "The configured Brand Template is unavailable or not fillable; using the verified editable Canva source design instead."
      : !templateImageAutofillReady
      ? "No usable Canva source with an image autofill field was found. Configure a Brand Template or source design with image and text autofill fields."
      : "Canva is connected, the required permissions are present, and the selected source supports image autofill.";
    return json({
      success: true,
      credentialsConfigured: credentialsConfigured(),
      canvaConnected: connected,
      brandTemplateConfigured: Boolean(CANVA_BRAND_TEMPLATE_IDS.length),
      brandTemplateCount: CANVA_BRAND_TEMPLATE_IDS.length,
      selectedBrandTemplateId,
      autofillSource: activeSource,
      sourceDesignConfigured: Boolean(CANVA_SOURCE_DESIGN_ID),
      missingScopes,
      templateImageFieldCount: imageFieldCount,
      templateTextFieldCount: textFieldCount,
      templateImageAutofillReady,
      creativeReadiness: fullyReady ? "READY" : "NEEDS_SETUP",
      integrationStatus: fullyReady ? "READY" : "NOT READY",
      detail,
      nextAction: missingScopes.length > 0
        ? "Reconnect Canva in Media Library to refresh OAuth permissions."
        : activeSource === "design"
        ? "The existing editable Canva design is being used as the autofill source; a Brand Template can be configured later."
        : !templateImageAutofillReady
        ? "Configure a Canva Brand Template or editable source design with text and image autofill fields."
        : fullyReady ? "Ready for varied Canva designs." : "Complete Canva credentials and connection setup.",
    });
  }

  if (body.mode !== "generate") return json({ success: false, code: "INVALID_INPUT" }, 400);
  if (!credentialsConfigured()) return json({ success: false, code: "NEEDS_CREDENTIAL" }, 424);

  const contentItemId = typeof body.contentItemId === "string" ? body.contentItemId : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const hook = typeof body.hook === "string" ? body.hook.trim() : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const sourceMediaAssetId = typeof body.sourceMediaAssetId === "string" ? body.sourceMediaAssetId : "";
  if (!/^[0-9a-f-]{36}$/i.test(contentItemId) || !topic) {
    return json({ success: false, code: "INVALID_INPUT" }, 400);
  }

  const tokenResult = await refreshCanvaAccessToken(serviceSupabase, staffId);
  if ("error" in tokenResult) return json({ success: false, code: tokenResult.error }, 424);

  const autofill = await createAutofillDesign(
    tokenResult.accessToken,
    serviceSupabase,
    contentItemId,
    topic,
    hook || topic,
    caption || topic,
    sourceMediaAssetId,
  );
  if ("error" in autofill) return json({ success: false, code: autofill.error }, 502);

  const exported = await exportDesignPng(tokenResult.accessToken, autofill.designId);
  if ("error" in exported) return json({ success: false, code: exported.error }, 502);

  const stored = await storeDesignForContentItem(
    serviceSupabase,
    staffId,
    contentItemId,
    exported.downloadUrl,
    topic,
    automationMode,
  );
  if ("error" in stored) return json({ success: false, code: stored.error }, 500);

  const { error: verificationError } = await serviceSupabase
    .from("staff_integrations")
    .update({
      status: "connected",
      last_tested_at: new Date().toISOString(),
      last_error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "canva")
    .eq("connected_by", staffId);
  if (verificationError) return json({ success: false, code: "INTEGRATION_VERIFICATION_UPDATE_FAILED" }, 500);

  return json({
    success: true,
    contentItemId,
    mediaAssetId: stored.mediaAssetId,
    storagePath: stored.storagePath,
    canvaDesignUrl: autofill.designUrl,
    imageApplied: autofill.imageApplied === true,
  });
});
