// supabase/functions/safe-content-publisher/index.ts
//
// Publishes ONE approved content_items row to Meta (Facebook Page and/or
// Instagram Business Account) via the Graph API, then records the outcome
// through `record_staff_content_publish_result` — called with the CALLING
// STAFF MEMBER'S OWN JWT, never service-role — so the write still goes
// through an RPC and lands in the Audit Log, same contract as every other
// mutation in this app.
//
// v1 scope only: immediate "Publish now" for content_items.status ===
// 'approved'. No scheduling here. No Instagram cron/poller.
//
// Secrets (set directly in this project, read only via Deno.env.get, never
// logged, never returned in any response, never written to the Audit Log):
//   FACEBOOK_PAGE_ID, FACEBOOK_PAGE_ACCESS_TOKEN,
//   INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN,
//   META_APP_SECRET, CONTENT_PUBLISHER_AUTOMATION_SECRET

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v21.0";
const FACEBOOK_PAGE_ID = Deno.env.get("FACEBOOK_PAGE_ID");
const FACEBOOK_PAGE_ACCESS_TOKEN = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");
const INSTAGRAM_ACCOUNT_ID = Deno.env.get("INSTAGRAM_ACCOUNT_ID");
const INSTAGRAM_ACCESS_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
const CONTENT_PUBLISHER_AUTOMATION_SECRET = Deno.env.get("CONTENT_PUBLISHER_AUTOMATION_SECRET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-content-publisher-automation-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

function fail(code: string, status = 400) {
  return new Response(JSON.stringify({ success: false, code }), { status, headers: JSON_HEADERS });
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

async function readContentItem(contentItemId: string, authToken: string, useServiceRole: boolean) {
  const key = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/content_items?id=eq.${encodeURIComponent(contentItemId)}&select=id,status,platform,caption,hook,cta,hashtags,provider_external_id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${authToken}` } });
  const items = response.ok ? await response.json() : [];
  return items[0] as { id: string; status: string; platform: string; caption: string; hook: string; cta: string; hashtags: string[]; provider_external_id?: string | null } | undefined;
}

async function readAutomationContentItem(contentItemId: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/content_items?id=eq.${encodeURIComponent(contentItemId)}&select=id,status,platform,caption,hook,cta,hashtags,provider_external_id&limit=1`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
  if (!response.ok) throw new Error("CONTENT_READ_FAILED");
  const items = await response.json();
  return items[0] as { id: string; status: string; platform: string; caption: string; hook: string; cta: string; hashtags: string[]; provider_external_id?: string | null } | undefined;
}

async function readPublishJob(jobId: string, contentItemId: string, platform: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/background_jobs?id=eq.${encodeURIComponent(jobId)}&job_type=eq.publish_content&status=eq.processing&select=id,job_type,status,payload&limit=1`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
  if (!response.ok) throw new Error("PUBLISH_JOB_READ_FAILED");
  const jobs = await response.json();
  const job = jobs[0] as { id: string; job_type: string; status: string; payload?: { contentItemId?: string; platform?: string } } | undefined;
  if (!job || job.payload?.contentItemId !== contentItemId || String(job.payload?.platform ?? '').toLowerCase() !== platform) return null;
  return job;
}

async function readPublishedReceipt(contentItemId: string, platform: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/content_publication_receipts?content_item_id=eq.${encodeURIComponent(contentItemId)}&platform=eq.${encodeURIComponent(platform)}&status=eq.published&select=external_post_id&order=created_at.desc&limit=1`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
  if (!response.ok) throw new Error("PUBLISH_RECEIPT_READ_FAILED");
  const receipts = await response.json();
  return (receipts[0] as { external_post_id?: string } | undefined)?.external_post_id ?? null;
}

async function publishAutomation(req: Request): Promise<Response> {
  let contentItemId: string;
  let jobId: string;
  try {
    const body = await req.json();
    if (typeof body?.contentItemId !== "string" || !body.contentItemId || typeof body?.jobId !== "string" || !body.jobId) throw new Error("missing job identity");
    contentItemId = body.contentItemId;
    jobId = body.jobId;
  } catch { return fail("INVALID_ACTION", 400); }
  let item: Awaited<ReturnType<typeof readAutomationContentItem>>;
  let job: Awaited<ReturnType<typeof readPublishJob>>;
  let existingProviderExternalId: string | null;
  try {
    item = await readAutomationContentItem(contentItemId);
    if (!item) return fail("NOT_FOUND", 404);
    const platform = String(item.platform ?? "").toLowerCase();
    if (platform !== "facebook" && platform !== "instagram") return fail("UNSUPPORTED_PLATFORM", 400);
    job = await readPublishJob(jobId, contentItemId, platform);
    if (!job) return fail("INVALID_PUBLISH_JOB", 409);
    if (item.status !== "approved" && item.status !== "scheduled") return fail("INVALID_TRANSITION", 409);
    existingProviderExternalId = await readPublishedReceipt(contentItemId, platform);
  } catch {
    return new Response(JSON.stringify({ success: false, ambiguous: true, code: "AMBIGUOUS_RESULT", jobId }), { status: 504, headers: JSON_HEADERS });
  }
  const platform = String(item.platform ?? "").toLowerCase();
  if (platform !== "facebook" && platform !== "instagram") return fail("UNSUPPORTED_PLATFORM", 400);
  if (!job) return fail("INVALID_PUBLISH_JOB", 409);
  if (existingProviderExternalId) {
    return new Response(JSON.stringify({ success: true, alreadyPublished: true, providerExternalId: existingProviderExternalId ?? item.provider_external_id ?? null, platform, jobId }), { status: 200, headers: JSON_HEADERS });
  }
  if (platform === "facebook" && (!FACEBOOK_PAGE_ID || !FACEBOOK_PAGE_ACCESS_TOKEN)) return fail("META_NOT_CONFIGURED", 500);
  if (platform === "instagram" && (!INSTAGRAM_ACCOUNT_ID || !INSTAGRAM_ACCESS_TOKEN)) return fail("META_NOT_CONFIGURED", 500);
  const imageUrl = await resolveSignedImageUrlWithToken(contentItemId, SUPABASE_SERVICE_ROLE_KEY);
  if (platform === "instagram" && !imageUrl) return fail("MEDIA_MISSING", 422);
  const caption = [item.hook, item.caption, item.cta, (item.hashtags ?? []).map((tag) => `#${tag}`).join(" " )].filter(Boolean).join("\n\n").slice(0, 5000);
  let publishResult: PublishOutcome;
  try {
    publishResult = platform === "facebook" ? await publishToFacebook(caption, imageUrl) : await publishToInstagram(caption, imageUrl);
  } catch (cause) {
    console.error("safe-content-publisher: ambiguous automation result", { contentItemId, jobId, platform, error: cause instanceof Error ? cause.name : "NETWORK_ERROR" });
    return new Response(JSON.stringify({ success: false, ambiguous: true, code: "AMBIGUOUS_RESULT", jobId, platform }), { status: 504, headers: JSON_HEADERS });
  }
  if (!publishResult.success || !publishResult.providerExternalId) {
    return new Response(JSON.stringify({ success: false, confirmed: true, code: publishResult.errorCode ?? "META_API_ERROR", jobId, platform }), { status: 502, headers: JSON_HEADERS });
  }
  return new Response(JSON.stringify({ success: true, providerExternalId: publishResult.providerExternalId, platform, jobId }), { status: 200, headers: JSON_HEADERS });
}

 type PublishOutcome = { success: boolean; providerExternalId?: string; errorCode?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", 405);
  const automationHeader = req.headers.get("x-content-publisher-automation-secret");
  if (automationHeader !== null) {
    if (!CONTENT_PUBLISHER_AUTOMATION_SECRET || !constantTimeEqual(automationHeader, CONTENT_PUBLISHER_AUTOMATION_SECRET)) return fail("UNAUTHORIZED", 401);
    return publishAutomation(req);
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return fail("SESSION_EXPIRED", 401);
  const staffJwt = authHeader.slice("Bearer ".length);
  let contentItemId: string;
  try { const body = await req.json(); if (typeof body?.contentItemId !== "string" || !body.contentItemId) throw new Error("missing contentItemId"); contentItemId = body.contentItemId; } catch { return fail("INVALID_ACTION", 400); }
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}` } });
  if (!userResponse.ok) return fail("SESSION_EXPIRED", 401);
  const user = (await userResponse.json()) as { id: string };
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/staff_profiles?id=eq.${encodeURIComponent(user.id)}&select=role,active&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}` } });
  const profiles = profileResponse.ok ? await profileResponse.json() : [];
  const profile = profiles[0] as { role?: string; active?: boolean } | undefined;
  const canPublish = profile?.active === true && ["super_admin", "admin", "content_manager"].includes(profile?.role ?? "");
  if (!canPublish) return fail("STAFF_ACCESS_DENIED", 403);
  const item = await readContentItem(contentItemId, staffJwt, false);
  if (!item) return fail("NOT_FOUND", 404);
  if (item.status !== "approved") return fail("INVALID_TRANSITION", 409);
  const platform = String(item.platform ?? "").toLowerCase();
  if (platform !== "facebook" && platform !== "instagram") return fail("UNSUPPORTED_PLATFORM", 400);
  if (platform === "facebook" && (!FACEBOOK_PAGE_ID || !FACEBOOK_PAGE_ACCESS_TOKEN)) return fail("META_NOT_CONFIGURED", 500);
  if (platform === "instagram" && (!INSTAGRAM_ACCOUNT_ID || !INSTAGRAM_ACCESS_TOKEN)) return fail("META_NOT_CONFIGURED", 500);
  const imageUrl = await resolveSignedImageUrl(contentItemId, staffJwt);
  if (platform === "instagram" && !imageUrl) return fail("MEDIA_MISSING", 422);
  const caption = [item.hook, item.caption, item.cta, (item.hashtags ?? []).map((tag) => `#${tag}`).join(" " )].filter(Boolean).join("\n\n").slice(0, 5000);
  let publishResult: PublishOutcome;
  try { publishResult = platform === "facebook" ? await publishToFacebook(caption, imageUrl) : await publishToInstagram(caption, imageUrl); } catch { publishResult = { success: false, errorCode: "META_API_ERROR" }; }
  const recordResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_staff_content_publish_result`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_content_item_id: contentItemId, p_success: publishResult.success, p_provider_external_id: publishResult.providerExternalId ?? null, p_platform: platform, p_error_code: publishResult.errorCode ?? null }) });
  const recorded = recordResponse.ok ? ((await recordResponse.json()) as { success: boolean }) : { success: false };
  if (!publishResult.success) { console.error("safe-content-publisher: Meta publish failed", { contentItemId, platform, errorCode: publishResult.errorCode }); return fail(publishResult.errorCode ?? "META_API_ERROR", 502); }
  if (!recorded.success) return fail("RECORD_FAILED", 500);
  return new Response(JSON.stringify({ success: true, providerExternalId: publishResult.providerExternalId, platform }), { status: 200, headers: JSON_HEADERS });
});

async function resolveSignedImageUrl(contentItemId: string, staffJwt: string): Promise<string | null> {
  const assetResponse = await fetch(`${SUPABASE_URL}/rest/v1/media_assets?content_item_id=eq.${encodeURIComponent(contentItemId)}&select=storage_path&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}` } });
  const assets = assetResponse.ok ? await assetResponse.json() : [];
  const storagePath = (assets[0] as { storage_path?: string } | undefined)?.storage_path;
  if (!storagePath) return null;
  const [bucket, ...rest] = storagePath.split("/"); const objectPath = rest.join("/"); if (!bucket || !objectPath) return null;
  const signResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${objectPath}`, { method: "POST", headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }) });
  if (!signResponse.ok) return null; const signed = (await signResponse.json()) as { signedURL?: string }; return signed.signedURL ? `${SUPABASE_URL}/storage/v1${signed.signedURL}` : null;
}

async function resolveSignedImageUrlWithToken(contentItemId: string, token: string): Promise<string | null> {
  const assetResponse = await fetch(`${SUPABASE_URL}/rest/v1/media_assets?content_item_id=eq.${encodeURIComponent(contentItemId)}&select=storage_path&limit=1`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  const assets = assetResponse.ok ? await assetResponse.json() : []; const storagePath = (assets[0] as { storage_path?: string } | undefined)?.storage_path; if (!storagePath) return null;
  const [bucket, ...rest] = storagePath.split("/"); const objectPath = rest.join("/"); if (!bucket || !objectPath) return null;
  const signResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${objectPath}`, { method: "POST", headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }) });
  if (!signResponse.ok) return null; const signed = (await signResponse.json()) as { signedURL?: string }; return signed.signedURL ? `${SUPABASE_URL}/storage/v1${signed.signedURL}` : null;
}

async function hmacProof(accessToken: string): Promise<string> {
  const secret = Deno.env.get("META_APP_SECRET"); if (!secret) throw new Error("META_APP_SECRET_MISSING");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accessToken));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function publishToFacebook(caption: string, imageUrl: string | null): Promise<PublishOutcome> {
  const endpoint = imageUrl ? `https://graph.facebook.com/${META_GRAPH_VERSION}/${FACEBOOK_PAGE_ID}/photos` : `https://graph.facebook.com/${META_GRAPH_VERSION}/${FACEBOOK_PAGE_ID}/feed`;
  const accessToken = FACEBOOK_PAGE_ACCESS_TOKEN!; const params = new URLSearchParams({ access_token: accessToken, appsecret_proof: await hmacProof(accessToken), published: "true" });
  if (imageUrl) { params.set("url", imageUrl); params.set("caption", caption); } else { params.set("message", caption); }
  const response = await fetch(endpoint, { method: "POST", body: params }); const data = await response.json(); if (!response.ok || data.error) return { success: false, errorCode: "META_API_ERROR" }; return { success: true, providerExternalId: String(data.post_id ?? data.id) };
}

async function publishToInstagram(caption: string, imageUrl: string | null): Promise<PublishOutcome> {
  if (!imageUrl) return { success: false, errorCode: "MEDIA_MISSING" };
  const accessToken = INSTAGRAM_ACCESS_TOKEN!; const createParams = new URLSearchParams({ access_token: accessToken, appsecret_proof: await hmacProof(accessToken), image_url: imageUrl, caption });
  const createResponse = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${INSTAGRAM_ACCOUNT_ID}/media`, { method: "POST", body: createParams }); const created = await createResponse.json(); if (!createResponse.ok || created.error || !created.id) return { success: false, errorCode: "META_API_ERROR" };
  const publishParams = new URLSearchParams({ access_token: accessToken, appsecret_proof: await hmacProof(accessToken), creation_id: created.id });
  const publishResponse = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${INSTAGRAM_ACCOUNT_ID}/media_publish`, { method: "POST", body: publishParams }); const published = await publishResponse.json(); if (!publishResponse.ok || published.error || !published.id) return { success: false, errorCode: "META_API_ERROR" }; return { success: true, providerExternalId: String(published.id) };
}
