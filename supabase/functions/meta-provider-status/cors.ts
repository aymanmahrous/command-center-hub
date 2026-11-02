export const PRODUCTION_ORIGIN = "https://hub.relaxfixuae.com";
export const WWW_PRODUCTION_ORIGIN = "https://www.hub.relaxfixuae.com";

export function allowedOrigin(origin: string | null | undefined): string {
  const value = (origin ?? "").trim();
  if (value === PRODUCTION_ORIGIN || value === WWW_PRODUCTION_ORIGIN) return value;
  // Preview deployments are owned by this Vercel team and use the project
  // hostname prefix. Never reflect arbitrary origins into CORS headers.
  if (/^https:\/\/command-center(?:-[a-z0-9-]+)?-swimmingayman-8492s-projects\.vercel\.app$/i.test(value)) return value;
  return PRODUCTION_ORIGIN;
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  return {
  "access-control-allow-origin": allowedOrigin(origin),
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "access-control-allow-methods": "POST, OPTIONS",
  };
}

export const CORS_HEADERS = corsHeaders(PRODUCTION_ORIGIN);

export function preflightResponse(origin?: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
