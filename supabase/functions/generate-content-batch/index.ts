import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

const SLOT_MIX = [
  { platform: "instagram", contentType: "carousel", contentPillar: "swimming_education", contentSlot: "education_midday", dayOffset: 0, hourGst: 9 },
  { platform: "facebook", contentType: "post", contentPillar: "swimming_education", contentSlot: "education_midday", dayOffset: 0, hourGst: 9 },
  { platform: "instagram", contentType: "post", contentPillar: "safety_awareness", contentSlot: "trust_morning", dayOffset: 1, hourGst: 9 },
  { platform: "facebook", contentType: "post", contentPillar: "parent_concerns", contentSlot: "trust_morning", dayOffset: 1, hourGst: 9 },
  { platform: "instagram", contentType: "reel", contentPillar: "real_progress", contentSlot: "conversion_evening", dayOffset: 2, hourGst: 18 },
  { platform: "tiktok", contentType: "video", contentPillar: "real_progress", contentSlot: "conversion_evening", dayOffset: 2, hourGst: 18 },
  { platform: "instagram", contentType: "post", contentPillar: "coach_authority", contentSlot: "trust_morning", dayOffset: 3, hourGst: 9 },
  { platform: "facebook", contentType: "post", contentPillar: "behind_the_scenes", contentSlot: "education_midday", dayOffset: 4, hourGst: 9 },
  { platform: "facebook", contentType: "post", contentPillar: "offer_booking", contentSlot: "conversion_evening", dayOffset: 5, hourGst: 18 },
  { platform: "instagram", contentType: "carousel", contentPillar: "water_fear", contentSlot: "trust_morning", dayOffset: 6, hourGst: 9 },
];

function gstSlotUtc(dayOffset: number, hourGst: number, start: Date): string {
  const base = new Date(start);
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + dayOffset + 1);
  base.setUTCHours(hourGst - 4, 0, 0, 0);
  return base.toISOString();
}

async function contentFingerprint(seed: string): Promise<string> {
  const data = new TextEncoder().encode(seed);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildPrompt(batchNonce: string, startIso: string) {
  return [
    "You generate a 10-item English social content batch for Relax Fix UAE Swimming Academy — Coach Ayman.",
    "Return strict JSON only: { \"items\": [ ... ] } with exactly 10 objects.",
    "Each item keys: platform, contentType, language, contentPillar, contentSlot, topic, hook, caption, cta, hashtags, visualPrompt.",
    "language must always be \"en\".",
    "Use these slot assignments in order (do not skip or reorder):",
    JSON.stringify(SLOT_MIX),
    "Brand rules:",
    "- Lead captions with \"Relax Fix UAE Swimming Academy — Coach Ayman\" when missing.",
    "- WhatsApp 058 821 9130 for messages & booking only. Phone 055 137 8660 for admin calls only.",
    "- Free initial assessment. Audience: parents in Abu Dhabi.",
    "- No guarantees, fake testimonials, #1 claims, or fabricated stats.",
    "- Facebook: at most #RelaxFixUAE hashtag.",
    "- Instagram/TikTok: 3-5 hashtags starting with #RelaxFixUAE.",
    "- visualPrompt must include lines starting with CANVA:, RUNWAY: (if video/reel), and CAPCUT: with concrete design/edit briefs.",
    "- cta must repeat WhatsApp/phone roles and free assessment.",
    `Batch nonce for uniqueness: ${batchNonce}. Start date ISO: ${startIso}.`,
    "Make topics fresh and varied within each pillar — do not repeat generic pool safety only.",
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

async function normalizeItems(rawItems: unknown[], batchNonce: string, start: Date) {
  const items = [];
  for (let index = 0; index < SLOT_MIX.length; index += 1) {
    const slot = SLOT_MIX[index];
    const raw = (rawItems[index] ?? {}) as JsonObject;
    const fingerprintSeed = `command-center-coach-ayman-2026:${batchNonce}:${index}:${slot.platform}:${String(raw.topic ?? slot.contentPillar)}`;
    items.push({
      platform: slot.platform,
      contentType: String(raw.contentType ?? slot.contentType),
      language: "en",
      contentPillar: slot.contentPillar,
      contentSlot: slot.contentSlot,
      plannedFor: gstSlotUtc(slot.dayOffset, slot.hourGst, start),
      topic: String(raw.topic ?? "").trim() || `Coach Ayman ${slot.contentPillar.replace(/_/g, " ")}`,
      hook: String(raw.hook ?? "").trim(),
      caption: String(raw.caption ?? "").trim(),
      cta: String(raw.cta ?? "").trim(),
      hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.map(String) : ["#RelaxFixUAE"],
      visualPrompt: String(raw.visualPrompt ?? "").trim(),
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
  const items = await normalizeItems(rawItems, batchNonce, start);
  return json({ success: true, provider: "gemini", items, batchNonce });
});
