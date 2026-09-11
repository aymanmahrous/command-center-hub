const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
export const CANVA_OPEN_URL = "https://www.canva.com/";

export type CanvaIntegrationStatus = "CONNECTED" | "NOT CONNECTED";

type CanvaSession = { accessToken: string };

type CanvaEdgeResponse = {
  success?: boolean;
  connected?: boolean;
  integrationStatus?: CanvaIntegrationStatus;
  credentialsConfigured?: boolean;
  detail?: string;
  authorizationUrl?: string;
  openUrl?: string;
  code?: string;
};

async function callCanvaOAuthEdge(session: CanvaSession, body: Record<string, unknown>): Promise<CanvaEdgeResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/canva-oauth`, {
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
  return (await response.json().catch(() => ({}))) as CanvaEdgeResponse;
}

export async function fetchCanvaIntegrationStatus(session: CanvaSession): Promise<{
  connected: boolean;
  integrationStatus: CanvaIntegrationStatus;
  detail: string;
  openUrl: string;
}> {
  try {
    const result = await callCanvaOAuthEdge(session, { mode: "status" });
    const connected = result.connected === true;
    return {
      connected,
      integrationStatus: connected ? "CONNECTED" : "NOT CONNECTED",
      detail: result.detail ?? (connected ? "Canva connected." : "Canva optional — not connected."),
      openUrl: result.openUrl ?? CANVA_OPEN_URL,
    };
  } catch (cause) {
    if (cause instanceof Error && cause.message === "SESSION_EXPIRED") throw cause;
    return {
      connected: false,
      integrationStatus: "NOT CONNECTED",
      detail: "Canva status unavailable — Command Center continues without Canva.",
      openUrl: CANVA_OPEN_URL,
    };
  }
}

export async function startCanvaConnect(session: CanvaSession): Promise<{ authorizationUrl: string }> {
  const result = await callCanvaOAuthEdge(session, { mode: "authorize" });
  if (result.code === "NEEDS_CREDENTIAL") {
    throw new Error("CANVA_NEEDS_CREDENTIAL");
  }
  if (!result.success || !result.authorizationUrl) {
    throw new Error(result.code ?? "CANVA_AUTHORIZE_FAILED");
  }
  return { authorizationUrl: result.authorizationUrl };
}

export function readCanvaCallbackNotice(search: string): "connected" | "error" | null {
  const params = new URLSearchParams(search);
  const canva = params.get("canva");
  if (canva === "connected") return "connected";
  if (canva === "error") return "error";
  return null;
}
