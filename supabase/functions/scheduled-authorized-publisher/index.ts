import { confirmedExternalPostId, formatHashtags, mediaApprovalError } from "../safe-content-publisher/text.ts";

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Authorized scheduled publisher. This endpoint is intentionally separate from
// safe-content-publisher so the owner-click publishing path is unchanged.
// The caller must provide the internal automation secret plus the exact
// authorization/job/content identity produced by the scheduled claim RPC.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AUTOMATION_SECRET = Deno.env.get("CONTENT_PUBLISHER_AUTOMATION_SECRET") ?? "";
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v21.0";
const FACEBOOK_PAGE_ID = Deno.env.get("FACEBOOK_PAGE_ID") ?? "1164107840123575";
const INSTAGRAM_ACCOUNT_ID = Deno.env.get("INSTAGRAM_ACCOUNT_ID") ?? "17841400516801494";
const FACEBOOK_TOKEN_FALLBACK = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN") ?? "";
const INSTAGRAM_ACCESS_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-content-publisher-automation-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Platform = "facebook" | "instagram";
type PublishItem = {
  id: string;
  status: string;
  platform: string;
  caption?: string | null;
  hook?: string | null;
  cta?: string | null;
  hashtags?: string[] | null;
  provider_external_id?: string | null;
  published_at?: string | null;
  media_asset_id?: string | null;
};
type PublishOutcome = { success: true; providerExternalId: string } | { success: false; errorCode: string };
type PublishContext = {
  contentItemId: string;
  jobId: string;
  authorizationId: string;
  platform: Platform;
  accountId: string;
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function constantTimeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function serviceHeaders(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...extra };
}

async function callRpc(name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) throw new Error(`RPC_${name}_HTTP_${res.status}`);
  return data;
}

async function readItem(contentItemId: string): Promise<PublishItem | null> {
  const url = `${SUPABASE_URL}/rest/v1/content_items?id=eq.${encodeURIComponent(contentItemId)}&select=id,status,platform,caption,hook,cta,hashtags,provider_external_id,published_at,media_asset_id&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error("CONTENT_READ_FAILED");
  const rows = await res.json();
  return (rows[0] as PublishItem | undefined) ?? null;
}

async function readJob(jobId: string, contentItemId: string, platform: Platform): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/background_jobs?id=eq.${encodeURIComponent(jobId)}&job_type=eq.publish_content&status=eq.processing&select=id,payload&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error("PUBLISH_JOB_READ_FAILED");
  const rows = await res.json();
  const job = rows[0] as { id: string; payload?: { contentItemId?: string; platform?: string } } | undefined;
  if (!job || job.payload?.contentItemId !== contentItemId) return false;
  if (job.payload?.platform && String(job.payload.platform).toLowerCase() !== platform) return false;
  return true;
}

async function signPrimaryImage(contentItemId: string, mediaAssetId: string | null | undefined): Promise<{ url: string | null; hasMedia: boolean; assetType: "image" | "video"; errorCode: string | null }> {
  if (!mediaAssetId) return { url: null, hasMedia: false, assetType: "image", errorCode: "MEDIA_MISSING" };
  const assetUrl = `${SUPABASE_URL}/rest/v1/media_assets?id=eq.${encodeURIComponent(mediaAssetId)}&select=storage_path,asset_type,source,content_item_id,category,media_status,consent_status,publishability_status,metadata&limit=1`;
  const assetRes = await fetch(assetUrl, { headers: serviceHeaders() });
  if (!assetRes.ok) throw new Error("MEDIA_LOOKUP_FAILED");
  const assets = await assetRes.json();
  const asset = assets[0] as {
    storage_path?: string; asset_type?: string; source?: string; content_item_id?: string;
    category?: string; media_status?: string; consent_status?: string; publishability_status?: string;
    metadata?: Record<string, unknown>;
  } | undefined;
  const errorCode = mediaApprovalError(asset, contentItemId);
  if (errorCode) return { url: null, hasMedia: false, assetType: "image", errorCode };
  const assetType = asset?.asset_type === "video" ? "video" : "image";
  const bucket = "relax-fix-media";
  const objectPath = String(asset?.storage_path ?? "").replace(/^\/+/, "");
  const encoded = [bucket, ...objectPath.split("/").map(encodeURIComponent)].join("/");
  const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${encoded}`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!signRes.ok) throw new Error("MEDIA_SIGN_FAILED");
  const signed = await signRes.json() as { signedURL?: string };
  if (!signed.signedURL) throw new Error("MEDIA_SIGN_FAILED");
  const url = signed.signedURL.startsWith("http") ? signed.signedURL : `${SUPABASE_URL}/storage/v1${signed.signedURL}`;
  return { url, hasMedia: true, assetType, errorCode: null };
}

async function hmacProof(accessToken: string): Promise<string> {
  const secret = Deno.env.get("META_APP_SECRET");
  if (!secret) throw new Error("META_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accessToken));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function resolveFacebookAccessToken(): Promise<string | null> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/staff_integrations?provider=eq.facebook&select=id,status&limit=1`;
    const res = await fetch(url, { headers: serviceHeaders() });
    if (res.ok) {
      const rows = await res.json() as Array<{ id?: string; status?: string }>;
      const integration = rows[0];
      if (integration?.id && (integration.status === "connected" || integration.status === "needs_test")) {
        const secretUrl = `${SUPABASE_URL}/rest/v1/staff_integration_secrets?integration_id=eq.${encodeURIComponent(integration.id)}&select=secret_value&limit=1`;
        const secretRes = await fetch(secretUrl, { headers: serviceHeaders() });
        if (secretRes.ok) {
          const secrets = await secretRes.json() as Array<{ secret_value?: string }>;
          const value = secrets[0]?.secret_value?.trim();
          if (value) return value;
        }
      }
    }
  } catch {
    // Keep credential lookup details out of logs and responses.
  }
  return FACEBOOK_TOKEN_FALLBACK.trim() || null;
}

function buildCaption(item: PublishItem): string {
  const tags = (item.hashtags ?? []).map((tag) => `#${String(tag).replace(/^#/, "")}`).join(" ");
  return [item.hook, item.caption, item.cta, tags].filter((part) => Boolean(part && String(part).trim())).map((part) => String(part).trim()).join("\n\n").slice(0, 5000);
}

async function publishFacebook(caption: string, mediaUrl: string | null, assetType: "image" | "video"): Promise<PublishOutcome> {
  const accessToken = await resolveFacebookAccessToken();
  if (!accessToken || !Deno.env.get("META_APP_SECRET")) return { success: false, errorCode: "META_NOT_CONFIGURED" };
  if (!mediaUrl) return { success: false, errorCode: "MEDIA_MISSING" };
  const proof = await hmacProof(accessToken);
  if (assetType === "video") {
    const params = new URLSearchParams({ access_token: accessToken, appsecret_proof: proof, file_url: mediaUrl, title: caption.slice(0, 120), description: caption, published: "true" });
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${FACEBOOK_PAGE_ID}/videos`, { method: "POST", body: params });
    const data = await res.json().catch(() => ({})) as { id?: string; error?: { code?: number | string } };
    if (!res.ok || data.error) return { success: false, errorCode: data.error?.code ? `META_API_ERROR_${data.error.code}` : "META_VIDEO_API_ERROR" };
    const id = String(data.id ?? "").trim();
    return id ? { success: true, providerExternalId: id } : { success: false, errorCode: "META_RESPONSE_MISSING_POST_ID" };
  }
  const params = new URLSearchParams({ access_token: accessToken, appsecret_proof: proof, url: mediaUrl, caption, published: "true" });
  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${FACEBOOK_PAGE_ID}/photos`, { method: "POST", body: params });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || data.error) return { success: false, errorCode: "META_API_ERROR" };
  const id = confirmedExternalPostId(data);
  return id ? { success: true, providerExternalId: id } : { success: false, errorCode: "META_RESPONSE_MISSING_POST_ID" };
}

async function publishInstagram(caption: string, mediaUrl: string | null, assetType: "image" | "video"): Promise<PublishOutcome> {
  if (!mediaUrl) return { success: false, errorCode: "MEDIA_MISSING" };
  if (!INSTAGRAM_ACCESS_TOKEN || !Deno.env.get("META_APP_SECRET")) return { success: false, errorCode: "META_NOT_CONFIGURED" };
  const proof = await hmacProof(INSTAGRAM_ACCESS_TOKEN);
  const createParams = assetType === "video"
    ? new URLSearchParams({ access_token: INSTAGRAM_ACCESS_TOKEN, appsecret_proof: proof, media_type: "REELS", video_url: mediaUrl, caption, share_to_feed: "true" })
    : new URLSearchParams({ access_token: INSTAGRAM_ACCESS_TOKEN, appsecret_proof: proof, image_url: mediaUrl, caption });
  const createRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${INSTAGRAM_ACCOUNT_ID}/media`, { method: "POST", body: createParams });
  const created = await createRes.json().catch(() => ({})) as { id?: string; error?: { code?: number | string } };
  if (!createRes.ok || created.error || !created.id) {
    return { success: false, errorCode: created.error?.code ? `META_API_ERROR_${created.error.code}` : "META_CONTAINER_CREATE_FAILED" };
  }
  const containerId = String(created.id);
  if (assetType === "video") {
    let finished = false;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const statusRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(INSTAGRAM_ACCESS_TOKEN)}&appsecret_proof=${encodeURIComponent(proof)}`);
      const statusData = await statusRes.json().catch(() => ({})) as { status_code?: string; error?: { code?: number | string } };
      if (!statusRes.ok || statusData.error) return { success: false, errorCode: "META_REEL_STATUS_FAILED" };
      const status = String(statusData.status_code ?? "").toUpperCase();
      if (status === "ERROR" || status === "EXPIRED") return { success: false, errorCode: "META_REEL_PROCESSING_FAILED" };
      if (status === "FINISHED") { finished = true; break; }
      if (attempt < 11) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    if (!finished) return { success: false, errorCode: "META_REEL_PROCESSING_TIMEOUT" };
  }
  const publishParams = new URLSearchParams({ access_token: INSTAGRAM_ACCESS_TOKEN, appsecret_proof: proof, creation_id: containerId });
  const publishRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${INSTAGRAM_ACCOUNT_ID}/media_publish`, { method: "POST", body: publishParams });
  const published = await publishRes.json().catch(() => ({})) as { id?: string; error?: { code?: number | string } };
  if (!publishRes.ok || published.error || !published.id) {
    return { success: false, errorCode: published.error?.code ? `META_API_ERROR_${published.error.code}` : "META_CONTAINER_PUBLISH_FAILED" };
  }
  return { success: true, providerExternalId: String(published.id) };
}

function failureArgs(ctx: PublishContext, outcome: "validation_failed" | "meta_auth_failed" | "ambiguous_result", error: string): { functionName: string; body: Record<string, unknown> } {
  const common = {
    p_job_id: ctx.jobId,
    p_authorization_id: ctx.authorizationId,
    p_content_item_id: ctx.contentItemId,
    p_platform: ctx.platform,
    p_outcome: outcome,
    p_error: error.slice(0, 500),
  };
  return ctx.platform === "instagram"
    ? { functionName: "fail_authorized_instagram_publish_job", body: { ...common, p_account_id: ctx.accountId } }
    : { functionName: "fail_authorized_publish_job", body: { ...common, p_page_id: ctx.accountId } };
}

async function recordFailure(ctx: PublishContext, outcome: "validation_failed" | "meta_auth_failed" | "ambiguous_result", error: string): Promise<boolean> {
  const call = failureArgs(ctx, outcome, error);
  try {
    const result = await callRpc(call.functionName, call.body);
    return result.success === true;
  } catch {
    return false;
  }
}

async function reserveReceipt(ctx: PublishContext): Promise<Record<string, unknown>> {
  const common = {
    p_authorization_id: ctx.authorizationId,
    p_job_id: ctx.jobId,
    p_content_item_id: ctx.contentItemId,
    p_platform: ctx.platform,
    p_provider: "meta-graph-publishing",
  };
  const functionName = ctx.platform === "instagram"
    ? "reserve_authorized_instagram_publication_receipt"
    : "reserve_authorized_facebook_publication_receipt";
  const body = ctx.platform === "instagram"
    ? { ...common, p_account_id: ctx.accountId }
    : { ...common, p_page_id: ctx.accountId };
  return callRpc(functionName, body);
}

async function markPublished(ctx: PublishContext, providerExternalId: string): Promise<Record<string, unknown>> {
  const common = {
    p_authorization_id: ctx.authorizationId,
    p_job_id: ctx.jobId,
    p_content_item_id: ctx.contentItemId,
    p_platform: ctx.platform,
    p_external_post_id: providerExternalId,
  };
  const functionName = ctx.platform === "instagram"
    ? "mark_authorized_instagram_publication_published"
    : "mark_authorized_publication_published";
  const body = ctx.platform === "instagram"
    ? { ...common, p_account_id: ctx.accountId }
    : { ...common, p_page_id: ctx.accountId };
  return callRpc(functionName, body);
}

function isMetaError(code: string): boolean { return code.startsWith("META_API_ERROR") || code.includes("META_CONTAINER_"); }
function isAmbiguousProviderError(code: string): boolean {
  return code === "META_RESPONSE_MISSING_POST_ID" || code === "META_CONTAINER_PUBLISH_FAILED";
}

async function handlePublish(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return response({ success: false, code: "INVALID_ACTION" }, 400); }

  const contentItemId = typeof body.contentItemId === "string" ? body.contentItemId.trim() : "";
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const authorizationId = typeof body.authorizationId === "string" ? body.authorizationId.trim() : "";
  const platformInput = typeof body.platform === "string" ? body.platform.toLowerCase() : "";
  const platform = platformInput === "facebook" || platformInput === "instagram" ? platformInput : null;
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  if (!contentItemId || !jobId || !authorizationId || !platform || !accountId) return response({ success: false, code: "INVALID_ACTION" }, 400);

  const expectedAccountId = platform === "facebook" ? FACEBOOK_PAGE_ID : INSTAGRAM_ACCOUNT_ID;
  const ctx: PublishContext = { contentItemId, jobId, authorizationId, platform, accountId };
  if (accountId !== expectedAccountId) {
    await recordFailure(ctx, "validation_failed", "ACCOUNT_ID_MISMATCH");
    return response({ success: false, code: "ACCOUNT_ID_MISMATCH", jobId, platform }, 409);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !AUTOMATION_SECRET) return response({ success: false, code: "PUBLISHER_NOT_CONFIGURED" }, 500);

  let item: PublishItem | null;
  let jobMatches: boolean;
  try {
    item = await readItem(contentItemId);
    jobMatches = await readJob(jobId, contentItemId, platform);
  } catch {
    const recorded = await recordFailure(ctx, "validation_failed", "DATABASE_READ_FAILED");
    return response({ success: false, code: "DATABASE_READ_FAILED", recorded, jobId, platform }, 503);
  }
  if (!item || !jobMatches || item.platform !== platform) {
    const recorded = await recordFailure(ctx, "validation_failed", "PUBLISH_JOB_OR_CONTENT_MISMATCH");
    return response({ success: false, code: "PUBLISH_JOB_OR_CONTENT_MISMATCH", recorded, jobId, platform }, 409);
  }
  if (item.status !== "scheduled" || item.provider_external_id || item.published_at) {
    const code = item.status === "published" || item.provider_external_id || item.published_at ? "ALREADY_PUBLISHED" : "INVALID_CONTENT_STATE";
    const recorded = await recordFailure(ctx, "validation_failed", code);
    return response({ success: false, code, recorded, jobId, platform }, 409);
  }

  let reserved: Record<string, unknown>;
  try { reserved = await reserveReceipt(ctx); }
  catch {
    const recorded = await recordFailure(ctx, "ambiguous_result", "RECEIPT_RESERVATION_UNCERTAIN");
    return response({ success: false, code: "RECEIPT_RESERVATION_UNCERTAIN", recorded, manualReviewRequired: true, jobId, platform }, 504);
  }
  if (reserved.success !== true || !["RESERVED", "ALREADY_RESERVED"].includes(String(reserved.code))) {
    const code = String(reserved.code ?? "PUBLICATION_RECEIPT_RESERVATION_FAILED");
    return response({ success: false, code, manualReviewRequired: code.includes("AMBIGUOUS") || code.includes("DIFFERENT_ATTEMPT"), jobId, platform }, 409);
  }

  let media: { url: string | null; hasMedia: boolean; assetType: "image" | "video"; errorCode: string | null };
  try { media = await signPrimaryImage(contentItemId, item.media_asset_id); }
  catch {
    const recorded = await recordFailure(ctx, "validation_failed", "MEDIA_SIGN_FAILED");
    return response({ success: false, code: "MEDIA_SIGN_FAILED", recorded, jobId, platform }, 422);
  }
  if (media.errorCode || !media.url) {
    const code = media.errorCode ?? "MEDIA_MISSING";
    const recorded = await recordFailure(ctx, "validation_failed", code);
    return response({ success: false, code, recorded, jobId, platform }, 422);
  }

  const caption = [item.hook, item.caption, item.cta, formatHashtags(item.hashtags)].filter(Boolean).join("\n\n").slice(0, 5000);
  let result: PublishOutcome;
  try { result = platform === "facebook" ? await publishFacebook(caption, media.url, media.assetType) : await publishInstagram(caption, media.url, media.assetType); }
  catch {
    const recorded = await recordFailure(ctx, "ambiguous_result", "PROVIDER_REQUEST_OUTCOME_UNKNOWN");
    return response({ success: false, code: "AMBIGUOUS_RESULT", recorded, manualReviewRequired: true, jobId, platform }, 504);
  }
  if (!result.success) {
    const outcome = isAmbiguousProviderError(result.errorCode)
      ? "ambiguous_result"
      : isMetaError(result.errorCode) ? "meta_auth_failed" : "validation_failed";
    const recorded = await recordFailure(ctx, outcome, result.errorCode);
    return response({ success: false, code: result.errorCode, recorded, manualReviewRequired: outcome === "ambiguous_result", jobId, platform }, outcome === "ambiguous_result" ? 504 : 502);
  }

  try {
    const completed = await markPublished(ctx, result.providerExternalId);
    if (completed.success === true) return response({ success: true, code: "PUBLISHED_ATOMIC", providerExternalId: result.providerExternalId, jobId, authorizationId, platform });
  } catch {
    // The provider may already have published. Quarantine the attempt rather than retrying it.
  }
  const recorded = await recordFailure(ctx, "ambiguous_result", "PUBLICATION_SENT_BUT_ATOMIC_COMPLETION_UNCONFIRMED");
  return response({ success: false, code: "AMBIGUOUS_RESULT", recorded, manualReviewRequired: true, jobId, platform }, 504);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
  if (req.method !== "POST") return response({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);
  if (!AUTOMATION_SECRET) return response({ success: false, code: "PUBLISHER_NOT_CONFIGURED" }, 500);
  const supplied = req.headers.get("x-content-publisher-automation-secret") ?? "";
  if (!constantTimeEqual(supplied, AUTOMATION_SECRET)) return response({ success: false, code: "UNAUTHORIZED" }, 401);
  return await handlePublish(req);
});
