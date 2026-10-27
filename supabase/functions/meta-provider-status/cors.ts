export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "https://hub.relaxfixuae.com",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
