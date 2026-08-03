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
// 'approved'. No scheduling here — the existing "Schedule" action keeps
// working exactly as before (DB-only, no Meta call). No Instagram
// scheduling/cron in this function; that is a separate, later decision.
//
// The Meta token NEVER appears in a response body or a log line. It is
// read once via Deno.env.get(...) and used only as an outbound
// Authorization/query parameter to graph.facebook.com.
//
// ASSUMPTIONS THAT NEED VERIFICATION AGAINST THE REAL SCHEMA (see the
// matching header in supabase/sql/2026xxxx_record_staff_content_publish_result.sql):
//   - content_items columns: status, platform, caption, hook, cta,
//     hashtags, content_type.
//   - media_assets column `content_item_id` linking an asset to a content
//     item, and `storage_path` formatted as "<bucket>/<path/to/file>".
//   - The `record_staff_content_publish_result` RPC exists (see the SQL
//     file above) and is NOT yet applied to any database.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v21.0";
const META_PAGE_ACCESS_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN");
const META_PAGE_ID = Deno.env.get("META_PAGE_ID");
const INSTAGRAM_BUSINESS_ACCOUNT_ID = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

function fail(code: string, status = 400) {
  return new Response(JSON.stringify({ success: false, code }), { status, headers: JSON_HEADERS });
}

type PublishOutcome = { success: boolean; providerExternalId?: string; errorCode?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return fail("SESSION_EXPIRED", 401);
  const staffJwt = authHeader.slice("Bearer ".length);

  let contentItemId: string;
  try {
    const body = await req.json();
    if (typeof body?.contentItemId !== "string" || !body.contentItemId) throw new Error("missing contentItemId");
    contentItemId = body.contentItemId;
  } catch {
    return fail("INVALID_ACTION", 400);
  }

  // 1. Verify the caller's session and staff profile — same pattern as the
  //    frontend's own auth check (auth/v1/user -> staff_profiles by id).
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}` },
  });
  if (!userResponse.ok) return fail("SESSION_EXPIRED", 401);
  const user = (await userResponse.json()) as { id: string };

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/staff_profiles?id=eq.${encodeURIComponent(user.id)}&select=role,active&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}` } },
  );
  const profiles = profileResponse.ok ? await profileResponse.json() : [];
  const profile = profiles[0] as { role?: string; active?: boolean } | undefined;
  const canPublish = profile?.active === true && ["super_admin", "admin", "content_manager"].includes(profile?.role ?? "");
  if (!canPublish) return fail("STAFF_ACCESS_DENIED", 403);

  // 2. Load the content item WITH the staff member's own JWT so RLS decides
  //    visibility, not this function.
  const itemResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/content_items?id=eq.${encodeURIComponent(contentItemId)}&select=id,status,platform,caption,hook,cta,hashtags&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}` } },
  );
  const items = itemResponse.ok ? await itemResponse.json() : [];
  const item = items[0] as { id: string; status: string; platform: string; caption: string; hook: string; cta: string; hashtags: string[] } | undefined;
  if (!item) return fail("NOT_FOUND", 404);
  if (item.status !== "approved") return fail("INVALID_TRANSITION", 409);

  const platform = String(item.platform ?? "").toLowerCase();
  if (platform !== "facebook" && platform !== "instagram") return fail("UNSUPPORTED_PLATFORM", 400);
  if (!META_PAGE_ACCESS_TOKEN || !META_PAGE_ID || (platform === "instagram" && !INSTAGRAM_BUSINESS_ACCOUNT_ID)) {
    return fail("META_NOT_CONFIGURED", 500);
  }

  // 3. Resolve the linked media asset and mint a short-lived signed Storage
  //    URL so Meta can fetch the image. This is the ONE place this function
  //    uses the service-role key — narrowly, to sign a Storage URL — never
  //    to bypass content_items RLS or the RBAC check above.
  const imageUrl = await resolveSignedImageUrl(contentItemId, staffJwt);
  if (platform === "instagram" && !imageUrl) return fail("MEDIA_MISSING", 422);

  const caption = [item.hook, item.caption, item.cta, (item.hashtags ?? []).map((tag) => `#${tag}`).join(" ")]
    .filter(Boolean).join("\n\n").slice(0, 5000);

  let publishResult: PublishOutcome;
  try {
    publishResult = platform === "facebook" ? await publishToFacebook(caption, imageUrl) : await publishToInstagram(caption, imageUrl);
  } catch {
    publishResult = { success: false, errorCode: "META_API_ERROR" };
  }

  // 4. Record the outcome through the RPC using the STAFF MEMBER'S OWN JWT
  //    — not service-role — so this write goes through the same RLS/RBAC
  //    path as every other mutation in the app, and lands in the Audit Log.
  const recordResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_staff_content_publish_result`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_content_item_id: contentItemId,
      p_success: publishResult.success,
      p_provider_external_id: publishResult.providerExternalId ?? null,
      p_platform: platform,
      p_error_code: publishResult.errorCode ?? null,
    }),
  });
  const recorded = recordResponse.ok ? ((await recordResponse.json()) as { success: boolean }) : { success: false };

  if (!publishResult.success) {
    console.error("safe-content-publisher: Meta publish failed", { contentItemId, platform, errorCode: publishResult.errorCode });
    return fail(publishResult.errorCode ?? "META_API_ERROR", 502);
  }
  if (!recorded.success) {
    // Meta post succeeded but we couldn't record it — surface distinctly so
    // an operator reconciles manually instead of silently losing state.
    console.error("safe-content-publisher: publish succeeded but recording failed", { contentItemId, platform });
    return new Response(
      JSON.stringify({ success: false, code: "RECORD_FAILED", providerExternalId: publishResult.providerExternalId }),
      { status: 500, headers: JSON_HEADERS },
    );
  }

  return new Response(JSON.stringify({ success: true, providerExternalId: publishResult.providerExternalId, platform }), { status: 200, headers: JSON_HEADERS });
});

async function resolveSignedImageUrl(contentItemId: string, staffJwt: string): Promise<string | null> {
  const assetResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/media_assets?content_item_id=eq.${encodeURIComponent(contentItemId)}&select=storage_path&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${staffJwt}` } },
  );
  const assets = assetResponse.ok ? await assetResponse.json() : [];
  const storagePath = (assets[0] as { storage_path?: string } | undefined)?.storage_path;
  if (!storagePath) return null;

  const [bucket, ...rest] = storagePath.split("/");
  const objectPath = rest.join("/");
  if (!bucket || !objectPath) return null;

  const signResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!signResponse.ok) return null;
  const signed = (await signResponse.json()) as { signedURL?: string };
  return signed.signedURL ? `${SUPABASE_URL}/storage/v1${signed.signedURL}` : null;
}

async function publishToFacebook(caption: string, imageUrl: string | null): Promise<PublishOutcome> {
  const endpoint = imageUrl
    ? `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PAGE_ID}/photos`
    : `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PAGE_ID}/feed`;
  const params = new URLSearchParams({ access_token: META_PAGE_ACCESS_TOKEN!, published: "true" });
  if (imageUrl) { params.set("url", imageUrl); params.set("caption", caption); } else { params.set("message", caption); }
  const response = await fetch(endpoint, { method: "POST", body: params });
  const data = await response.json();
  if (!response.ok || data.error) return { success: false, errorCode: "META_API_ERROR" };
  return { success: true, providerExternalId: String(data.post_id ?? data.id) };
}

async function publishToInstagram(caption: string, imageUrl: string | null): Promise<PublishOutcome> {
  if (!imageUrl) return { success: false, errorCode: "MEDIA_MISSING" };
  const createParams = new URLSearchParams({ access_token: META_PAGE_ACCESS_TOKEN!, image_url: imageUrl, caption });
  const createResponse = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`, { method: "POST", body: createParams });
  const created = await createResponse.json();
  if (!createResponse.ok || created.error || !created.id) return { success: false, errorCode: "META_API_ERROR" };

  const publishParams = new URLSearchParams({ access_token: META_PAGE_ACCESS_TOKEN!, creation_id: created.id });
  const publishResponse = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`, { method: "POST", body: publishParams });
  const published = await publishResponse.json();
  if (!publishResponse.ok || published.error || !published.id) return { success: false, errorCode: "META_API_ERROR" };
  return { success: true, providerExternalId: String(published.id) };
}
