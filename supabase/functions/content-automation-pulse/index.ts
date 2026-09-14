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
const GEMINI_MODEL = "gemini-2.0-flash";
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
        generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
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

  try {
    const evaluation = await supabase.rpc("evaluate_content_batch_generation_need");
    if (evaluation.error) throw evaluation.error;
    summary = { ...summary, generation: evaluation.data };

    if (evaluation.data?.shouldGenerate) {
      const cycleKey = String(evaluation.data.cycleKey);
      const startIso = typeof evaluation.data.suggestedStartIso === "string"
        ? evaluation.data.suggestedStartIso
        : new Date().toISOString();
      const batchNonce = `${cycleKey}:${crypto.randomUUID()}`;
      const built = await buildBatchItems(batchNonce, new Date(startIso));
      const saved = await saveBatchWithShift(supabase, built.items, cycleKey);
      summary = {
        ...summary,
        contentBrainGenerationTriggered: true,
        generationProvider: built.provider,
        batchId: saved.batchId,
        generationCode: saved.code,
      };
    }

    await supabase.rpc("complete_content_automation_run", {
      p_run_id: runId,
      p_status: "completed",
      p_media_attempts: 0,
      p_media_processed: 0,
      p_publish_attempts: 0,
      p_publish_processed: 0,
      p_summary: summary,
    });

    await supabase.rpc("release_content_automation_lease", {
      p_lease_name: LEASE_NAME,
      p_lease_token: leaseToken,
    });

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
