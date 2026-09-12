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
  contentFingerprint,
  ensureMediaBrief,
  ensureRelaxFixBrandLead,
  gstSlotUtc,
  primaryCtaForSlot,
} from "./coach-ayman-slot-spec.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
const GEMINI_MODEL = "gemini-2.0-flash";
const ALLOWED_ROLES = new Set(["super_admin", "admin", "content_manager"]);
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

function credentialStatus() {
  if (!GEMINI_API_KEY) {
    return {
      connected: false,
      integrationStatus: "NEEDS CREDENTIAL",
      detail: "Set GEMINI_API_KEY in Supabase Edge Function secrets (server-side only).",
      code: "NEEDS_CREDENTIAL",
    };
  }
  return {
    connected: true,
    integrationStatus: "CONNECTED",
    detail: "Gemini batch text generation ready.",
    code: "READY",
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
    "Do NOT output platform/contentType/contentPillar/contentSlot/hashtags/cta — those are assigned server-side.",
    "Use these slot assignments in order (do not skip or reorder):",
    JSON.stringify(slotInstructions, null, 2),
    "Brand and audience:",
    "- Parents in Abu Dhabi considering kids swimming, water confidence, safety, and beginner guidance.",
    "- Coach Ayman authority, real progress, private/group lessons, initial assessment.",
    "- Lead captionBody with Relax Fix UAE Swimming Academy — Coach Ayman when missing.",
    "Marketing funnel mix (already assigned per slot): attraction, education, trust, engagement, conversion.",
    "Content type mix (already assigned per slot): carousel, story, reel, short_video, video, post.",
    "Primary CTA per slot is provided — include that exact primary CTA line inside captionBody.",
    "Do not repeat the same primary CTA wording across all 10 items.",
    "Forbidden claims: guaranteed, #1, award-winning, 100% success, Olympic coach, world record, fake testimonials.",
    "Arabic + English:",
    "- When arabicHint is present, add one short Arabic parent line inside captionBody (caption-level only).",
    "Media brief rules for visualPrompt:",
    "- Must include lines starting with FORMAT:, VISUAL CONCEPT:, HEADLINE:, SUPPORTING TEXT:, SCENE IDEA:, CTA:, CANVA:, CAPCUT:.",
    "- Add RUNWAY (optional): only for reel/short_video/video slots.",
    "- Keep CANVA line concrete for Canva template work.",
    `Batch nonce for uniqueness: ${batchNonce}. Start date ISO: ${startIso}.`,
    "Make topics fresh within each slot seed — do not copy slot seeds verbatim unless improved.",
  ].join("\n");
}

async function callGemini(prompt: string) {
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
  if (!response.ok) return { error: json({ success: false, code: "GEMINI_REQUEST_FAILED", status: response.status }, 502) };
  const payload = await response.json().catch(() => null) as JsonObject | null;
  const parts = ((payload?.candidates as JsonObject[] | undefined)?.[0]?.content as JsonObject | undefined)?.parts as JsonObject[] | undefined;
  const text = parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) return { error: json({ success: false, code: "GEMINI_EMPTY_RESPONSE" }, 502) };
  try {
    return { data: JSON.parse(text) as JsonObject };
  } catch {
    return { error: json({ success: false, code: "GEMINI_INVALID_JSON" }, 502) };
  }
}

function stripTrackedFooter(caption: string): string {
  return caption
    .replace(/\n*Relax Fix UAE Swimming Academy\nWhatsApp 058 821 9130 — messages & booking[\s\S]*$/i, "")
    .trim();
}

async function normalizeItems(rawItems: unknown[], batchNonce: string, start: Date) {
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
  const status = credentialStatus();

  if (body.mode === "status") {
    return json({
      success: true,
      connected: status.connected,
      integrationStatus: status.integrationStatus,
      detail: status.detail,
      code: status.code,
      credentialEnvVar: "GEMINI_API_KEY",
    });
  }

  if (body.mode !== "generate") return json({ success: false, code: "INVALID_INPUT" }, 400);
  if (!status.connected) {
    return json({
      success: false,
      connected: false,
      code: "NEEDS_CREDENTIAL",
      detail: status.detail,
    }, 424);
  }

  const batchNonce = typeof body.batchNonce === "string" && body.batchNonce.trim() ? body.batchNonce.trim() : crypto.randomUUID();
  const start = typeof body.startIso === "string" ? new Date(body.startIso) : new Date();
  const gemini = await callGemini(buildPrompt(batchNonce, start.toISOString()));
  if ("error" in gemini && gemini.error) return gemini.error;

  const rawItems = Array.isArray(gemini.data?.items) ? gemini.data.items : [];
  if (rawItems.length !== COACH_AYMAN_BATCH_SIZE) {
    return json({ success: false, code: "GEMINI_ITEM_COUNT_MISMATCH", expected: COACH_AYMAN_BATCH_SIZE, received: rawItems.length }, 502);
  }

  try {
    const items = await normalizeItems(rawItems, batchNonce, start);
    return json({ success: true, provider: "gemini", items, batchNonce });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "GEMINI_NORMALIZE_FAILED";
    return json({ success: false, code: message }, 502);
  }
});
