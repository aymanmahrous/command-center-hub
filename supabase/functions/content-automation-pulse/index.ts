import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  COACH_AYMAN_BATCH_SIZE,
  COACH_AYMAN_PROVIDER_ID,
  COACH_AYMAN_SLOT_SPEC,
  FORBIDDEN_CLAIMS,
  PRIMARY_CTAS,
  buildBatchTrackedCta,
  buildHashtags,
  buildTemplateBatchItems,
  contentFingerprint,
  ensureMediaBrief,
  ensureRelaxFixBrandLead,
  gstSlotUtc,
  primaryCtaForSlot,
} from "../generate-content-batch/coach-ayman-slot-spec.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
const CONTENT_PUBLISHER_AUTOMATION_SECRET = Deno.env.get("CONTENT_PUBLISHER_AUTOMATION_SECRET") ?? "";
const GEMINI_MODEL = "gemini-3.8-flash";
const LEASE_NAME = "content_automation_pulse";
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-relax-fix-scheduler",
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

function buildPrompt(batchNonce: string, startIso: string) {
  const slotInstructions = COACH_AYMAN_SLOT_SPEC.map((slot, index) => ({
    index,
    platform: slot.platform,
    contentType: slot.contentType,
    contentPillar: slot.contentPillar,
    contentSlot: slot.contentSlot,
    funnel: slot.funnel,
    topicSeed: slot.topicSeed,
    hookSeed: slot.hookSeed,
    primaryCta: PRIMARY_CTAS[slot.primaryCtaKey],
    topicHashtags: slot.topicHashtags,
    arabicHint: slot.arabicHint ?? null,
    briefFormat: slot.briefFormat,
  }));

  return [
    "You generate a 10-item English social content batch for Relax Fix UAE Swimming Academy — Coach Ayman.",
    "Return strict JSON only: { \"items\": [ ... ] } with exactly 10 objects.",
    "Each item keys: topic, hook, captionBody, visualPrompt.",
    JSON.stringify(slotInstructions, null, 2),
    `Batch nonce for uniqueness: ${batchNonce}. Start date ISO: ${startIso}.`,
  ].join("\n");
}

async function callGemini(prompt: string) {
  if (!GEMINI_API_KEY) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as JsonObject | null;
  const parts = ((payload?.candidates as JsonObject[] | undefined)?.[0]?.content as JsonObject | undefined)?.parts as JsonObject[] | undefined;
  const text = parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    return JSON.parse(text) as JsonObject;
  } catch {
    return null;
  }
}

function stripTrackedFooter(caption: string): string {
  return caption
    .replace(/\n*Relax Fix UAE Swimming Academy\nWhatsApp 058 821 9130 — messages & booking[\s\S]*$/i, "")
    .trim();
}

async function normalizeGeminiItems(rawItems: unknown[], batchNonce: string, start: Date) {
  const items = [];
  for (let index = 0; index < COACH_AYMAN_SLOT_SPEC.length; index += 1) {
    const slot = COACH_AYMAN_SLOT_SPEC[index];
    const raw = (rawItems[index] ?? {}) as JsonObject;
    const primaryCta = primaryCtaForSlot(slot);
    const trackedCta = buildBatchTrackedCta(slot.platform, slot.contentPillar);
    const topic = String(raw.topic ?? slot.topicSeed).trim() || slot.topicSeed;
    const hook = String(raw.hook ?? slot.hookSeed).trim() || slot.hookSeed;
    const rawBody = String(raw.captionBody ?? raw.caption ?? "").trim();
    const body = stripTrackedFooter(rawBody) || slot.topicSeed;
    const brandedBody = ensureRelaxFixBrandLead(body);
    const captionBody = brandedBody.includes(primaryCta) ? brandedBody : `${brandedBody}\n\n${primaryCta}`;
    const caption = `${captionBody}\n\n${trackedCta}`;
    const visualPrompt = ensureMediaBrief(String(raw.visualPrompt ?? "").trim(), slot, primaryCta);
    const fingerprintSeed = `${COACH_AYMAN_PROVIDER_ID}:${batchNonce}:${index}:${slot.platform}:${topic}`;
    if (FORBIDDEN_CLAIMS.test(`${topic} ${hook} ${caption}`)) {
      throw new Error(`FORBIDDEN_CLAIM_LANGUAGE_AT_${index}`);
    }
    items.push({
      platform: slot.platform,
      contentType: slot.contentType,
      language: "en",
      contentPillar: slot.contentPillar,
      contentSlot: slot.contentSlot,
      plannedFor: gstSlotUtc(slot.dayOffset, slot.hourGst, start),
      topic,
      hook,
      caption,
      cta: trackedCta,
      hashtags: buildHashtags(slot.platform, slot.topicHashtags),
      visualPrompt,
      contentFingerprint: await contentFingerprint(fingerprintSeed),
    });
  }
  return items;
}

async function buildBatchItems(batchNonce: string, start: Date) {
  const geminiPayload = await callGemini(buildPrompt(batchNonce, start.toISOString()));
  const rawItems = Array.isArray(geminiPayload?.items) ? geminiPayload.items : [];
  if (rawItems.length === COACH_AYMAN_BATCH_SIZE) {
    try {
      return { items: await normalizeGeminiItems(rawItems, batchNonce, start), provider: "gemini" };
    } catch {
      // fall through to template
    }
  }
  return { items: await buildTemplateBatchItems(batchNonce, start), provider: "template" };
}

const PUBLISH_QUEUE_CUTOVER_AT = "2026-11-02T00:00:00.000Z";
const FACEBOOK_PAGE_ID = "1164107840123575";
const INSTAGRAM_ACCOUNT_ID = "17841400516801494";
const AUTHORIZED_PUBLISHER_TIMEOUT_MS = 120_000;
const AUTHORIZED_PUBLISHER_URL = `${SUPABASE_URL}/functions/v1/scheduled-authorized-publisher`;

async function processOneAuthorizedPublishJob(supabase: ReturnType<typeof createClient>) {
  if (!CONTENT_PUBLISHER_AUTOMATION_SECRET) {
    return { attempts: 0, processed: 0, outcome: { code: "PUBLISHER_AUTOMATION_SECRET_MISSING" } };
  }
  const now = new Date();
  const { data: jobs, error: jobsError } = await supabase.from("background_jobs")
    .select("id,payload,status,created_at,next_retry_at")
    .eq("job_type", "publish_content")
    .in("status", ["queued", "retrying"])
    .gte("created_at", PUBLISH_QUEUE_CUTOVER_AT)
    .order("created_at", { ascending: true })
    .limit(50);
  if (jobsError) throw jobsError;

  for (const job of jobs ?? []) {
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    const contentItemId = String(payload.contentItemId ?? "").trim();
    const platform = String(payload.platform ?? "").toLowerCase();
    const dueAt = job.next_retry_at ?? job.created_at;
    if (!contentItemId || !["facebook", "instagram"].includes(platform)) continue;
    if (String(payload.source ?? "") !== "staff_schedule") continue;
    if (!dueAt || new Date(String(dueAt)).getTime() > now.getTime()) continue;

    const accountId = platform === "facebook" ? FACEBOOK_PAGE_ID : INSTAGRAM_ACCOUNT_ID;
    const { data: item, error: itemError } = await supabase.from("content_items")
      .select("id,status,platform,scheduled_for,published_at,provider_external_id")
      .eq("id", contentItemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item || item.status !== "scheduled" || String(item.platform).toLowerCase() !== platform) continue;
    if (!item.scheduled_for || new Date(item.scheduled_for).getTime() > now.getTime()) continue;
    if (item.published_at || item.provider_external_id) continue;

    const { data: receipts, error: receiptError } = await supabase.from("content_publication_receipts")
      .select("id,status,external_post_id").eq("content_item_id", contentItemId).eq("platform", platform).limit(2);
    if (receiptError) throw receiptError;
    if ((receipts ?? []).length > 0) continue;

    const { data: transitions, error: auditError } = await supabase.from("audit_logs")
      .select("id,actor_id,detail,created_at").eq("action", "content_item_transitioned")
      .eq("entity_type", "content_item").eq("entity_id", contentItemId)
      .order("created_at", { ascending: false }).limit(20);
    if (auditError) throw auditError;
    const scheduleEvent = (transitions ?? []).find(row =>
      row.detail?.requestedAction === "schedule" && row.detail?.nextStatus === "scheduled"
    );
    if (!scheduleEvent || transitions?.[0]?.id !== scheduleEvent.id) continue;
    const approvalEvent = (transitions ?? []).find(row =>
      row.detail?.requestedAction === "approve" && row.detail?.nextStatus === "approved"
      && row.actor_id && new Date(row.created_at).getTime() <= new Date(scheduleEvent.created_at).getTime()
    );
    if (!approvalEvent?.actor_id) continue;
    const { data: owner, error: ownerError } = await supabase.from("staff_profiles")
      .select("role,active").eq("id", approvalEvent.actor_id).maybeSingle();
    if (ownerError) throw ownerError;
    if (!owner || owner.active !== true || owner.role !== "super_admin") continue;

    const { data: activeJobs, error: activeJobsError } = await supabase.from("background_jobs")
      .select("id,status,created_at").eq("job_type", "publish_content")
      .filter("payload->>contentItemId", "eq", contentItemId)
      .in("status", ["queued", "retrying", "processing"])
      .order("created_at", { ascending: false }).limit(5);
    if (activeJobsError) throw activeJobsError;
    if ((activeJobs ?? []).length !== 1 || activeJobs?.[0]?.id !== job.id) continue;

    const { data: existingAuthorizations, error: authReadError } = await supabase.from("owner_publish_authorizations")
      .select("id,consumed_at,revoked_at,expires_at,publish_job_id").eq("publish_job_id", job.id).limit(2);
    if (authReadError) throw authReadError;
    if ((existingAuthorizations ?? []).length > 1) continue;
    let authorizationId = "";
    const existingAuthorization = existingAuthorizations?.[0];
    if (existingAuthorization) {
      if (existingAuthorization.consumed_at || existingAuthorization.revoked_at || !existingAuthorization.expires_at
          || new Date(existingAuthorization.expires_at).getTime() <= now.getTime()) continue;
      authorizationId = existingAuthorization.id;
    } else {
      const createName = platform === "facebook" ? "create_owner_publish_authorization" : "create_owner_instagram_publish_authorization";
      const createArgs = platform === "facebook"
        ? { p_content_item_id: contentItemId, p_platform: platform, p_page_id: accountId, p_authorized_by: String(approvalEvent.actor_id), p_approval_reference: String(approvalEvent.id), p_ttl_minutes: 15 }
        : { p_content_item_id: contentItemId, p_platform: platform, p_account_id: accountId, p_authorized_by: String(approvalEvent.actor_id), p_approval_reference: String(approvalEvent.id), p_ttl_minutes: 15 };
      const { data: created, error: createError } = await supabase.rpc(createName, createArgs);
      if (createError) return { attempts: 0, processed: 0, outcome: { code: "OWNER_AUTHORIZATION_CREATE_FAILED", platform } };
      if (!created?.authorizationId || created.jobId !== job.id || created.contentItemId !== contentItemId) continue;
      authorizationId = String(created.authorizationId);
    }

    const claimName = platform === "facebook" ? "claim_authorized_publish_job" : "claim_authorized_instagram_publish_job";
    const claimArgs = platform === "facebook"
      ? { p_content_item_id: contentItemId, p_platform: platform, p_page_id: accountId }
      : { p_content_item_id: contentItemId, p_platform: platform, p_account_id: accountId };
    const { data: claimed, error: claimError } = await supabase.rpc(claimName, claimArgs);
    if (claimError) throw claimError;
    if (!claimed?.claimed) return { attempts: 0, processed: 0, outcome: { code: claimed?.code ?? "AUTHORIZED_CLAIM_SKIPPED", platform } };
    if (claimed.jobId !== job.id || claimed.authorizationId !== authorizationId) {
      return { attempts: 1, processed: 0, outcome: { code: "AUTHORIZED_CLAIM_MISMATCH", jobId: job.id, platform } };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUTHORIZED_PUBLISHER_TIMEOUT_MS);
    try {
      const response = await fetch(AUTHORIZED_PUBLISHER_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-content-publisher-automation-secret": CONTENT_PUBLISHER_AUTOMATION_SECRET },
        body: JSON.stringify({ contentItemId, jobId: job.id, authorizationId, platform, accountId }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (body.success === true && body.code === "PUBLISHED_ATOMIC"
          && typeof body.providerExternalId === "string" && body.providerExternalId.trim()) {
        return { attempts: 1, processed: 1, outcome: { code: "PUBLISHED_ATOMIC", jobId: job.id, platform, providerExternalId: body.providerExternalId } };
      }
      return { attempts: 1, processed: 0, outcome: {
        code: String(body.code ?? "AUTHORIZED_PUBLISH_REJECTED"), jobId: job.id, platform,
        ambiguous: body.manualReviewRequired === true || body.ambiguous === true || response.status === 504,
      } };
    } catch (cause) {
      return { attempts: 1, processed: 0, outcome: {
        code: "AMBIGUOUS_RESULT", jobId: job.id, platform, ambiguous: true,
        detail: cause instanceof Error ? cause.name : "NETWORK_ERROR",
      } };
    } finally {
      clearTimeout(timeout);
    }
  }
  return { attempts: 0, processed: 0, outcome: { code: "NO_NEW_OWNER_APPROVED_DUE_JOB" } };
}

async function processOneMediaJob(supabase: ReturnType<typeof createClient>) {
  const claimed = await supabase.rpc("claim_next_content_media_job");
  if (claimed.error) throw claimed.error;
  if (!claimed.data?.claimed) return { attempts: 0, processed: 0, outcome: claimed.data ?? { code: "NO_MEDIA_JOB" } };

  const jobId = String(claimed.data.jobId ?? "");
  const contentItemId = String(claimed.data.contentItemId ?? "");
  if (!jobId || !contentItemId) {
    return { attempts: 1, processed: 0, outcome: { code: "MEDIA_CLAIM_PAYLOAD_INVALID", jobId, contentItemId } };
  }

  const { data: item, error: itemError } = await supabase
    .from("content_items")
    .select("topic,hook,caption,content_type")
    .eq("id", contentItemId)
    .maybeSingle();
  if (itemError || !item) {
    await supabase.rpc("fail_content_media_job", { p_job_id: jobId, p_error: "CONTENT_ITEM_READ_FAILED" });
    return { attempts: 1, processed: 0, outcome: { code: "CONTENT_ITEM_READ_FAILED", jobId } };
  }

  // Canva creates PNG images, not Reel/video assets. Do not label a Canva PNG as video
  // or incur generation calls without an explicitly approved video-provider path.
  if (String(item.content_type ?? "").toLowerCase() === "reel") {
    const failed = await supabase.rpc("fail_content_media_job", {
      p_job_id: jobId,
      p_error: "VIDEO_PROVIDER_REQUIRES_EXPLICIT_APPROVAL",
    });
    return {
      attempts: 1,
      processed: 0,
      outcome: {
        code: failed.error ? "MEDIA_FAIL_RECORD_FAILED" : "MEDIA_PROVIDER_BLOCKED",
        jobId,
        failure: "VIDEO_PROVIDER_REQUIRES_EXPLICIT_APPROVAL",
      },
    };
  }

  if (!CONTENT_PUBLISHER_AUTOMATION_SECRET) {
    return { attempts: 1, processed: 0, outcome: { code: "PUBLISHER_AUTOMATION_SECRET_MISSING", jobId, ambiguous: true } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/canva-design`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-content-publisher-automation-secret": CONTENT_PUBLISHER_AUTOMATION_SECRET,
      },
      body: JSON.stringify({
        mode: "generate",
        contentItemId,
        topic: String(item.topic ?? ""),
        hook: String(item.hook ?? ""),
        caption: String(item.caption ?? ""),
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (body.success === true && typeof body.mediaAssetId === "string") {
      const completed = await supabase.rpc("complete_content_media_job", {
        p_job_id: jobId,
        p_storage_path: String(body.storagePath ?? ""),
        p_provider: "canva",
        p_provider_job_id: String(body.mediaAssetId),
        p_metadata: { mediaAssetId: body.mediaAssetId, automated: true },
      });
      if (completed.error || !completed.data?.success) {
        return { attempts: 1, processed: 0, outcome: { code: "MEDIA_COMPLETE_FAILED", jobId, ambiguous: true } };
      }
      return { attempts: 1, processed: 1, outcome: { code: "MEDIA_COMPLETED", jobId, mediaAssetId: body.mediaAssetId } };
    }

    const confirmed = response.status >= 400 && response.status < 500 && body.code !== "CANVA_TOKEN_REFRESH_FAILED";
    if (confirmed) {
      const failed = await supabase.rpc("fail_content_media_job", { p_job_id: jobId, p_error: String(body.code ?? "MEDIA_GENERATION_FAILED") });
      return { attempts: 1, processed: 0, outcome: { code: failed.error ? "MEDIA_FAIL_RECORD_FAILED" : "MEDIA_FAILED", jobId, failure: body.code ?? "MEDIA_GENERATION_FAILED" } };
    }

    await supabase.rpc("defer_content_media_job", { p_job_id: jobId, p_reason: String(body.code ?? "MEDIA_RETRY"), p_delay_seconds: 1800 });
    return { attempts: 1, processed: 0, outcome: { code: "MEDIA_DEFERRED", jobId, reason: body.code ?? "MEDIA_RETRY" } };
  } catch (cause) {
    await supabase.rpc("defer_content_media_job", { p_job_id: jobId, p_reason: cause instanceof Error ? cause.name : "NETWORK_ERROR", p_delay_seconds: 1800 });
    return { attempts: 1, processed: 0, outcome: { code: "MEDIA_DEFERRED", jobId, ambiguous: true } };
  } finally {
    clearTimeout(timeout);
  }
}

async function saveBatchWithShift(
  supabase: ReturnType<typeof createClient>,
  items: JsonObject[],
  cycleKey: string,
) {
  for (let shiftDays = 0; shiftDays <= 14; shiftDays += 1) {
    const shifted = shiftDays === 0
      ? items
      : items.map((item) => {
        const planned = new Date(String(item.plannedFor));
        planned.setUTCDate(planned.getUTCDate() + shiftDays);
        return { ...item, plannedFor: planned.toISOString() };
      });
    const { data, error } = await supabase.rpc("create_automated_content_batch", {
      p_items: shifted,
      p_provider_external_id: COACH_AYMAN_PROVIDER_ID,
      p_cycle_key: cycleKey,
    });
    if (error) {
      if (error.message.includes("CONTENT_SLOT_ALREADY_PLANNED")) continue;
      throw error;
    }
    return data as JsonObject;
  }
  throw new Error("CONTENT_SLOT_ALREADY_PLANNED");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ success: false, code: "SERVER_MISCONFIGURED" }, 500);
  }

  const token = bearerToken(request);
  if (!token) return json({ success: false, code: "AUTH_REQUIRED" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const verify = await supabase.rpc("verify_content_automation_scheduler_token", { p_token: token });
  if (verify.error || !verify.data?.valid) {
    return json({ success: false, code: verify.data?.code ?? "SCHEDULER_TOKEN_INVALID" }, 401);
  }

  // Live publishing requires BOTH explicit switches. This pulse never runs Gemini or Canva generation.
  const dryRunRequested = Deno.env.get("CONTENT_AUTOMATION_LIVE_ENABLED") !== "true"
    || Deno.env.get("CONTENT_PUBLISHING_LIVE_ENABLED") !== "true";

  const lease = await supabase.rpc("claim_content_automation_lease", {
    p_lease_name: LEASE_NAME,
    p_lease_seconds: 240,
  });
  if (lease.error) return json({ success: false, code: "LEASE_ERROR", detail: lease.error.message }, 500);
  if (!lease.data?.claimed) {
    return json({ success: true, code: "LEASE_HELD", skipped: true, detail: lease.data });
  }

  const leaseToken = String(lease.data.leaseToken);
  const run = await supabase.rpc("start_content_automation_run", { p_source: "supabase_cron" });
  if (run.error || !run.data?.runId) {
    await supabase.rpc("release_content_automation_lease", { p_lease_name: LEASE_NAME, p_lease_token: leaseToken });
    return json({ success: false, code: "RUN_START_FAILED", detail: run.error?.message }, 500);
  }

  const runId = String(run.data.runId);
  let summary: JsonObject = {
    contentBrainGenerationTriggered: false,
    humanApprovalRequired: true,
    publishing: [],
    media: [],
  };

  // Explicit dry-run records a scheduler heartbeat only. Keep this before every
  // generation, media-claim, and publishing path so it cannot process queue work.
  if (dryRunRequested) {
    const dryRunSummary: JsonObject = {
      mode: "dry-run",
      sideEffectsSkipped: true,
      contentBrainGenerationTriggered: false,
      humanApprovalRequired: true,
      publishing: [],
      media: [],
    };
    const completed = await supabase.rpc("complete_content_automation_run", {
      p_run_id: runId,
      p_status: "completed",
      p_media_attempts: 0,
      p_media_processed: 0,
      p_publish_attempts: 0,
      p_publish_processed: 0,
      p_summary: dryRunSummary,
    });
    await supabase.rpc("release_content_automation_lease", {
      p_lease_name: LEASE_NAME,
      p_lease_token: leaseToken,
    });
    if (completed.error) {
      return json({ success: false, code: "DRY_RUN_RECORD_FAILED", runId }, 500);
    }
    return json({ success: true, runId, summary: dryRunSummary });
  }

  try {
    // Publishing-only release: generation and media workers remain disabled to avoid unapproved creation or provider spend.
    const publishing = await processOneAuthorizedPublishJob(supabase);
    summary = { ...summary, mode: "authorized-publishing-only", contentBrainGenerationTriggered: false, publishing: [publishing.outcome], media: [] };
    await supabase.rpc("complete_content_automation_run", {
      p_run_id: runId, p_status: "completed", p_media_attempts: 0, p_media_processed: 0,
      p_publish_attempts: publishing.attempts, p_publish_processed: publishing.processed, p_summary: summary,
    });
    await supabase.rpc("release_content_automation_lease", { p_lease_name: LEASE_NAME, p_lease_token: leaseToken });
    return json({ success: true, runId, summary });

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "CONTENT_AUTOMATION_PULSE_FAILED";
    await supabase.rpc("fail_content_automation_run", {
      p_run_id: runId,
      p_error: message,
      p_summary: summary,
    });
    await supabase.rpc("release_content_automation_lease", {
      p_lease_name: LEASE_NAME,
      p_lease_token: leaseToken,
    });
    return json({ success: false, code: "PULSE_FAILED", error: message, runId }, 500);
  }
});
