import type { GeneratedBatchItem } from "./content-batch-generator";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type GeminiBatchSession = { accessToken: string };

type GeminiBatchEdgeResponse = {
  success?: boolean;
  connected?: boolean;
  integrationStatus?: string;
  items?: GeneratedBatchItem[];
  code?: string;
  detail?: string;
};

async function callGenerateContentBatchEdge(session: GeminiBatchSession, body: Record<string, unknown>): Promise<GeminiBatchEdgeResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content-batch`, {
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
  return (await response.json().catch(() => ({}))) as GeminiBatchEdgeResponse;
}

export async function fetchGeminiBatchGenerationStatus(session: GeminiBatchSession): Promise<{ connected: boolean; detail: string }> {
  try {
    const result = await callGenerateContentBatchEdge(session, { mode: "status" });
    const connected = result.connected === true;
    return {
      connected,
      detail: result.detail ?? (connected ? "Gemini batch generation ready." : "Gemini batch generation unavailable."),
    };
  } catch (cause) {
    if (cause instanceof Error && cause.message === "SESSION_EXPIRED") throw cause;
    return { connected: false, detail: "Gemini batch generation status unavailable." };
  }
}

export async function generateCoachAymanBatchWithGemini(
  session: GeminiBatchSession,
  batchNonce: string,
  start = new Date(),
): Promise<GeneratedBatchItem[] | null> {
  const result = await callGenerateContentBatchEdge(session, {
    mode: "generate",
    batchNonce,
    startIso: start.toISOString(),
  });
  if (result.code === "NEEDS_CREDENTIAL" || result.code === "GEMINI_UNAVAILABLE") return null;
  if (!result.success || !Array.isArray(result.items) || result.items.length === 0) {
    throw new Error(result.code ?? "GEMINI_BATCH_FAILED");
  }
  return result.items;
}
