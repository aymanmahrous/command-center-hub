import { buildCoachAyman2026BatchWithMedia } from "./media-batch-link";
import { parseCoachKnowledgeContext } from "./content-batch-generator";
import { parseMediaAssetRecords } from "./media-library-controls";
import { COACH_AYMAN_PROVIDER_ID } from "./content-batch-generator";

type Session = { accessToken: string };
type JsonObject = Record<string, unknown>;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

async function callRpc(session: Session, rpcName: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(rpcName)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  if (!response.ok) {
    const bodyText = await response.text();
    if (bodyText.includes("CONTENT_SLOT_ALREADY_PLANNED")) throw new Error("CONTENT_SLOT_ALREADY_PLANNED");
    throw new Error(`RPC_FAILED_${response.status}`);
  }
  return response.json() as Promise<JsonObject>;
}

export type CoachBrainActionResult = {
  kind: "content" | "design" | "image" | "video";
  batchId: string | null;
  itemCount: number;
  contentItemIds?: string[];
  provider?: string;
  taskId?: string | null;
  output?: string | null;
  status: "created";
};

async function callGeneration(session: Session, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/runway-media`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  const result = await response.json().catch(() => ({})) as JsonObject;
  if (!response.ok || result.success !== true) throw new Error(typeof result.code === "string" ? result.code : "GENERATION_FAILED");
  return result;
}

export async function executeCoachBrainContentGeneration(session: Session, request = ""): Promise<CoachBrainActionResult> {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || !session.accessToken) throw new Error("AUTH_REQUIRED");

  const requestedOutcome = request.trim().slice(0, 4000);
  const normalized = requestedOutcome.toLocaleLowerCase();
  if (/فيديو|فديو|video|reel|runway/.test(normalized)) {
    const result = await callGeneration(session, { mode: "generate", task: "video_generation", prompt: requestedOutcome, explicitRequest: true });
    return { kind: "video", batchId: null, itemCount: 0, provider: typeof result.provider === "string" ? result.provider : "runway", taskId: typeof result.taskId === "string" ? result.taskId : null, status: "created" };
  }
  if (/صورة|صور|image|photo|design|تصميم/.test(normalized) && !/canva|كانفا/.test(normalized)) {
    const result = await callGeneration(session, { mode: "generate", task: "image_generation", prompt: requestedOutcome, explicitRequest: true });
    return { kind: "image", batchId: null, itemCount: 0, provider: typeof result.provider === "string" ? result.provider : "openai", output: typeof result.output === "string" ? result.output : null, status: "created" };
  }

  const mediaRaw = await callRpc(session, "get_staff_media_assets");
  const assets = parseMediaAssetRecords(mediaRaw);

  let knowledgeContext = parseCoachKnowledgeContext(null);
  try {
    const knowledgeRaw = await callRpc(session, "get_staff_knowledge_management", {
      p_search: null,
      p_language: null,
      p_status: "active",
    });
    knowledgeContext = parseCoachKnowledgeContext(knowledgeRaw);
  } catch {
    knowledgeContext = parseCoachKnowledgeContext(null);
  }

  const nonce = crypto.randomUUID();

  for (let shiftDays = 0; shiftDays <= 45; shiftDays += 1) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + shiftDays);
    const batchNonce = shiftDays === 0 ? nonce : `${nonce}-${shiftDays}`;
    const requestedDaysMatch = normalized.match(/(?:\b|^)(\d{1,2})\s*(?:يوم|days?|day)/i);
    const requestedDays = requestedDaysMatch ? Math.min(Math.max(Number(requestedDaysMatch[1]), 1), 30) : 30;
    const generatedItems = await buildCoachAyman2026BatchWithMedia(assets, start, batchNonce, knowledgeContext);
    const items = generatedItems.slice(0, requestedDays);

    try {
      const saved = await callRpc(session, "create_staff_generated_content_batch", {
        p_items: items,
        p_provider_external_id: COACH_AYMAN_PROVIDER_ID,
      });
      const batchId = typeof saved.batchId === "string" ? saved.batchId : null;
      const contentItemIds = Array.isArray(saved.contentItemIds)
        ? saved.contentItemIds.filter((value): value is string => typeof value === "string")
        : [];
      if (saved.success !== true) throw new Error(typeof saved.code === "string" ? saved.code : "GENERATE_REJECTED");

      if (/canva|كانفا|تصميم/.test(normalized) && contentItemIds[0]) {
        const designResponse = await fetch(`${SUPABASE_URL}/functions/v1/canva-design`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            mode: "generate",
            contentItemId: contentItemIds[0],
            topic: items[0]?.topic ?? requestedOutcome,
            hook: items[0]?.hook ?? requestedOutcome,
            caption: items[0]?.caption ?? requestedOutcome,
            canvaBrief: items[0]?.visualPrompt ?? requestedOutcome,
          }),
          cache: "no-store",
        });
        if (designResponse.status === 401 || designResponse.status === 403) throw new Error("SESSION_EXPIRED");
        const designResult = await designResponse.json().catch(() => ({})) as JsonObject;
        if (!designResponse.ok || designResult.success !== true) {
          throw new Error(typeof designResult.code === "string" ? designResult.code : "CANVA_DESIGN_FAILED");
        }
        return { kind: "design", batchId, itemCount: items.length, contentItemIds, provider: "canva", status: "created" };
      }

      return { kind: "content", batchId, itemCount: items.length, contentItemIds, status: "created" };
    } catch (cause) {
      if (cause instanceof Error && cause.message === "CONTENT_SLOT_ALREADY_PLANNED") continue;
      throw cause;
    }
  }

  throw new Error("CONTENT_SLOT_ALREADY_PLANNED");
}
