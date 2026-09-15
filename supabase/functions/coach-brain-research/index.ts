import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
const GEMINI_MODEL = "gemini-3.7-flash";
const ALLOWED_ROLES = new Set(["super_admin", "admin", "coach", "reception"]);
const CORS_HEADERS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };

type JsonObject = Record<string, unknown>;
function json(body: JsonObject, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS } }); }
function bearerToken(request: Request) { const value = request.headers.get("authorization") ?? ""; return value.startsWith("Bearer ") ? value.slice(7).trim() : ""; }
function sanitizeQuestion(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email removed]").replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone removed]").replace(/https?:\/\/\S+/gi, "[url removed]").trim().slice(0, 5000);
}
async function requireStaff(supabase: ReturnType<typeof createClient>, token: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { error: json({ success: false, code: "AUTH_REQUIRED" }, 401) };
  const { data: profile, error } = await supabase.from("staff_profiles").select("id, role, active").eq("id", authData.user.id).maybeSingle();
  if (error || !profile?.active || !ALLOWED_ROLES.has(String(profile.role))) return { error: json({ success: false, code: "STAFF_ACCESS_DENIED" }, 403) };
  return { staffId: authData.user.id };
}
function buildPrompt(question: string) {
  return [
    "You are Coach Brain, an evidence-based swimming and aquatic-training research assistant for a professional coach.",
    "Research the web before answering. Use Google Search grounding and prioritize high-quality, verifiable evidence.",
    "Source hierarchy: systematic reviews and meta-analyses first; peer-reviewed primary research and PubMed next; recognized sport-science organizations, governing bodies and professional guidance next; reputable educational sources only when stronger evidence is unavailable.",
    "Prefer recent evidence (especially 2020-2026) when relevant, while retaining older landmark research when it remains important. When a recommendation is important, cross-check it against more than one independent source when possible.",
    "The coach can ask ANY swimming teaching, technique, race-performance, training, motor-learning, adaptive-swimming, aquatic-fitness, weight-management-in-water, equipment, start, turn, breathing, pacing, strength, conditioning, or water-safety question.",
    "Do not narrow the question to swimming strokes if the user asks about general training in water. Explain what can realistically be achieved in water and what requires land-based or professional support.",
    "Give a practical answer that a swimming coach can use beside the pool. Separate evidence-supported findings from your practical coaching application.",
    "Use this exact response structure with these headings:",
    "## Direct answer\n## First step\n## Why this approach\n## Drills\n## Suggested session\n## Equipment\n## What to measure\n## Progression\n## Alternatives\n## Safety / referral\n## Evidence level\n## Limitations\n## Sources",
    "For drills and sessions, give concrete, age-appropriate instructions, repetitions/distance/rest only when supported or clearly presented as a practical starting point rather than proven dosage.",
    "For youth swimmers, consider developmental appropriateness; do not treat a child like an adult athlete. For weight management, avoid promises of specific weight loss and focus on safe, sustainable activity and appropriate professional guidance when needed.",
    "Do not diagnose ADHD, autism, injury, disease, obesity, or other medical conditions. Do not prescribe medical treatment or clinical rehabilitation.",
    "For pain, acute injury, serious breathing problems, neurological/medical rehabilitation, eating-disorder concerns, or clinical concerns, stay within coaching scope and recommend an appropriate licensed professional when warranted.",
    "For water safety, never imply that swimming skill alone makes someone drowning-proof. Never recommend forced submersion or coercive teaching.",
    "Do not invent study findings, citations, exact performance claims, or dosage. If evidence is mixed, weak, indirect, or absent, say so explicitly. Do not claim one method is universally best without evidence.",
    "Never repeat names, phone numbers, emails, addresses, IDs, or other identifying information from the question. Do not create or imply a saved child or swimmer record.",
    "Include 3-8 useful source links in the Sources section when search results support them. Do not cite a source that does not support the claim. Prefer direct article or organization URLs over search-result pages.",
    "Coach question:",
    question,
  ].join("\n\n");
}
async function callGemini(prompt: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as JsonObject | null;
    const error = payload?.error;
    const detail = typeof error === "object" && error ? String((error as JsonObject).message ?? "").slice(0, 300) : "";
    return { error: json({ success: false, code: "GEMINI_REQUEST_FAILED", providerStatus: response.status, ...(detail ? { detail } : {}) }, 502) };
  }
  const payload = await response.json().catch(() => null) as JsonObject | null;
  const candidate = (payload?.candidates as JsonObject[] | undefined)?.[0];
  const parts = (candidate?.content as JsonObject | undefined)?.parts as JsonObject[] | undefined;
  const text = parts?.map((part) => part.text).find((value) => typeof value === "string" && value.trim());
  if (!text) return { error: json({ success: false, code: "GEMINI_EMPTY_RESPONSE" }, 502) };
  const grounding = candidate?.groundingMetadata as JsonObject | undefined;
  const chunks = Array.isArray(grounding?.groundingChunks) ? grounding.groundingChunks : [];
  const sources = chunks.map((chunk) => { const web = (chunk as JsonObject).web as JsonObject | undefined; return web && typeof web.uri === "string" ? { title: String(web.title ?? web.uri), url: web.uri } : null; }).filter(Boolean) as { title: string; url: string }[];
  return { data: { answer: String(text), sources: [...new Map(sources.map((source) => [source.url, source])).values()], searchQueries: Array.isArray(grounding?.webSearchQueries) ? grounding.webSearchQueries : [] } };
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ success: false, code: "SERVER_MISCONFIGURED" }, 500);
  if (!GEMINI_API_KEY) return json({ success: false, code: "NEEDS_CREDENTIAL" }, 424);
  const token = bearerToken(request);
  if (!token) return json({ success: false, code: "AUTH_REQUIRED" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const staff = await requireStaff(supabase, token);
  if ("error" in staff && staff.error) return staff.error;
  const body = await request.json().catch(() => ({})) as JsonObject;
  const question = sanitizeQuestion(body.question);
  if (!question) return json({ success: false, code: "QUESTION_REQUIRED" }, 400);
  const result = await callGemini(buildPrompt(question));
  if ("error" in result && result.error) return result.error;
  return json({ success: true, query: question, ...(result.data as JsonObject) });
});
