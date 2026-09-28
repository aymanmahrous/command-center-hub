const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export type AiProvider = "gemini" | "openai";
export type AiProviderStatus = {
  provider: AiProvider;
  label: string;
  configured: boolean;
  status: "AVAILABLE" | "NOT_CONFIGURED";
  detail: string;
  credentialEnvVar: string;
};

type Session = { accessToken: string };
type RouterResponse = { success?: boolean; code?: string; detail?: string; providers?: AiProviderStatus[]; provider?: AiProvider };

async function callRouter(session: Session, body: Record<string, unknown>): Promise<RouterResponse> {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) throw new Error("CONFIGURATION_REQUIRED");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-provider-router`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as RouterResponse;
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  if (!response.ok || !payload.success) throw new Error(payload.code ?? "AI_PROVIDER_FAILED");
  return payload;
}

export async function fetchAiProviderStatuses(session: Session) {
  const result = await callRouter(session, { mode: "status" });
  return result.providers ?? [];
}

export async function selectAiProvider(session: Session, provider: AiProvider) {
  return callRouter(session, { mode: "select", provider });
}
