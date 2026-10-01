export const CANVA_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

export type CanvaAction = "status" | "authorize";

type GateResult<T> = { ok: true; value: T } | { ok: false; response: Response };

function jsonError(code: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, code }), {
    status,
    headers: { "content-type": "application/json", ...CANVA_CORS_HEADERS },
  });
}

/** Keep this guard before staff lookup/body parsing in the Edge Function. */
export function requireCanvaBearer(request: Request): GateResult<string> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return token
    ? { ok: true, value: token }
    : { ok: false, response: jsonError("AUTH_REQUIRED", 400) };
}

/** Call only after requireCanvaBearer and the staff-role check succeed. */
export async function parseCanvaAction(request: Request): Promise<GateResult<CanvaAction>> {
  const body: unknown = await request.json().catch(() => ({}));
  if (body && typeof body === "object" && "mode" in body) {
    const mode = (body as { mode?: unknown }).mode;
    if (mode === "status" || mode === "authorize") {
      return { ok: true, value: mode };
    }
  }
  return { ok: false, response: jsonError("INVALID_INPUT", 400) };
}
