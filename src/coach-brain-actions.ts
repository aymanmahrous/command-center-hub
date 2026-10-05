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
  batchId: string | null;
  itemCount: number;
  status: "created";
};

export async function executeCoachBrainContentGeneration(session: Session): Promise<CoachBrainActionResult> {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || !session.accessToken) throw new Error("AUTH_REQUIRED");

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
    const items = await buildCoachAyman2026BatchWithMedia(assets, start, batchNonce, knowledgeContext);

    try {
      const saved = await callRpc(session, "create_staff_generated_content_batch", {
        p_items: items,
        p_provider_external_id: COACH_AYMAN_PROVIDER_ID,
      });
      const batchId = typeof saved.batchId === "string" ? saved.batchId : null;
      if (saved.success !== true) throw new Error(typeof saved.code === "string" ? saved.code : "GENERATE_REJECTED");
      return { batchId, itemCount: items.length, status: "created" };
    } catch (cause) {
      if (cause instanceof Error && cause.message === "CONTENT_SLOT_ALREADY_PLANNED") continue;
      throw cause;
    }
  }

  throw new Error("CONTENT_SLOT_ALREADY_PLANNED");
}
