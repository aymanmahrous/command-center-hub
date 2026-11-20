import type { IncomingMessage, ServerResponse } from "node:http";
import process from "node:process";
import { z } from "zod";

type AuthRequest = IncomingMessage & { body?: unknown };
type AuthHandler = (request: AuthRequest, response: ServerResponse) => Promise<void>;

const REFRESH_COOKIE = "__Secure-relaxfix-command-refresh";
const ProfileSchema = z.object({
  display_name: z.string().min(1),
  role: z.enum(["super_admin", "admin", "reception", "coach", "content_manager"]),
  active: z.literal(true),
});
const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).max(4096),
  expires_in: z.number().positive(),
  user: z.object({ id: z.string().uuid() }),
});
const BootstrapBodySchema = z.object({ refreshToken: z.string().min(1).max(4096) });
const LogoutBodySchema = z.object({ accessToken: z.string().min(1).max(8192) });

class AuthApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly clearCookie = false,
  ) {
    super(code);
  }
}

function setResponseHeaders(response: ServerResponse) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Vary", "Cookie");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.end(JSON.stringify(body));
}

function setRefreshCookie(response: ServerResponse, refreshToken: string) {
  response.setHeader(
    "Set-Cookie",
    `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/api/auth; HttpOnly; Secure; SameSite=Strict`,
  );
}

function clearRefreshCookie(response: ServerResponse) {
  response.setHeader(
    "Set-Cookie",
    `${REFRESH_COOKIE}=; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  );
}

function isSameOrigin(request: AuthRequest): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin !== "string" || typeof host !== "string" || !host) return false;

  try {
    const parsed = new URL(origin);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return false;
    if (parsed.origin !== origin || parsed.host.toLowerCase() !== host.toLowerCase()) return false;
    const fetchSite = request.headers["sec-fetch-site"];
    if (typeof fetchSite === "string" && !["same-origin", "none"].includes(fetchSite)) return false;
    return true;
  } catch {
    return false;
  }
}

function previewAuthDisabled(): boolean {
  return process.env.VERCEL_ENV === "preview" && process.env.AUTH_BFF_PREVIEW_ENABLED !== "true";
}

function readRefreshCookie(request: AuthRequest): string | null {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== REFRESH_COOKIE) continue;
    const value = item.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

async function readJsonBody(request: AuthRequest): Promise<unknown> {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || !contentType.toLowerCase().includes("application/json")) {
    throw new AuthApiError("INVALID_REQUEST", 415);
  }

  if (request.body !== undefined) {
    if (typeof request.body === "string") {
      try { return JSON.parse(request.body); } catch { throw new AuthApiError("INVALID_REQUEST", 400); }
    }
    return request.body;
  }

  let raw = "";
  for await (const chunk of request) {
    const part = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array);
    raw += part;
    if (raw.length > 8192) throw new AuthApiError("INVALID_REQUEST", 413);
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new AuthApiError("INVALID_REQUEST", 400);
  }
}

function legacyKeyRole(key: string): string | null {
  try {
    const payload = key.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

function getSupabaseConfig() {
  const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const urlValue = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  const publicKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const staffTable = (process.env.VITE_STAFF_PROFILE_TABLE || "staff_profiles").trim();

  let validUrl = false;
  try {
    const parsed = new URL(urlValue);
    validUrl = parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    validUrl = false;
  }
  const validKey = /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(publicKey) || legacyKeyRole(publicKey) === "anon";
  if (!validUrl || !validKey || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(staffTable)) {
    throw new AuthApiError("CONFIGURATION_REQUIRED", 503);
  }
  return { url: urlValue, publicKey, staffTable };
}

async function loadStaffProfile(config: ReturnType<typeof getSupabaseConfig>, accessToken: string, userId: string) {
  let response: Response;
  try {
    response = await fetch(
      `${config.url}/rest/v1/${encodeURIComponent(config.staffTable)}?id=eq.${encodeURIComponent(userId)}&select=display_name,role,active&limit=1`,
      {
        headers: {
          apikey: config.publicKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new AuthApiError("SERVICE_UNAVAILABLE", 503);
  }

  if (response.status === 401) throw new AuthApiError("SESSION_EXPIRED", 401, true);
  if (response.status === 403) throw new AuthApiError("STAFF_ACCESS_DENIED", 403, true);
  if (response.status === 429) throw new AuthApiError("TOO_MANY_ATTEMPTS", 503);
  if (response.status >= 500) throw new AuthApiError("SERVICE_UNAVAILABLE", 503);
  if (!response.ok) throw new AuthApiError("PROFILE_CHECK_FAILED", 502);

  let rows: z.infer<typeof ProfileSchema>[];
  try {
    rows = z.array(ProfileSchema).parse(await response.json());
  } catch {
    throw new AuthApiError("PROFILE_CHECK_FAILED", 502);
  }
  if (rows.length !== 1) throw new AuthApiError("STAFF_ACCESS_DENIED", 403, true);
  return { displayName: rows[0].display_name, role: rows[0].role };
}

async function rotateAndVerify(refreshToken: string, response: ServerResponse) {
  const config = getSupabaseConfig();
  let upstream: Response;
  try {
    upstream = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.publicKey },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AuthApiError("SERVICE_UNAVAILABLE", 503);
  }

  if (upstream.status === 400 || upstream.status === 401 || upstream.status === 403) {
    throw new AuthApiError("SESSION_EXPIRED", 401, true);
  }
  if (upstream.status === 429) throw new AuthApiError("TOO_MANY_ATTEMPTS", 503);
  if (upstream.status >= 500) throw new AuthApiError("SERVICE_UNAVAILABLE", 503);
  if (!upstream.ok) throw new AuthApiError("AUTH_UPSTREAM_FAILED", 502);

  let tokens: z.infer<typeof TokenResponseSchema>;
  try {
    tokens = TokenResponseSchema.parse(await upstream.json());
  } catch {
    throw new AuthApiError("AUTH_UPSTREAM_FAILED", 502);
  }

  // Persist the rotated token in the HttpOnly cookie before profile verification.
  // If the profile service is temporarily unavailable, the new token remains recoverable.
  setRefreshCookie(response, tokens.refresh_token);
  try {
    const profile = await loadStaffProfile(config, tokens.access_token, tokens.user.id);
    return {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      displayName: profile.displayName,
      role: profile.role,
    };
  } catch (cause) {
    if (cause instanceof AuthApiError && cause.clearCookie) clearRefreshCookie(response);
    throw cause;
  }
}

async function run(request: AuthRequest, response: ServerResponse, action: () => Promise<void>) {
  setResponseHeaders(response);
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      throw new AuthApiError("METHOD_NOT_ALLOWED", 405);
    }
    if (!isSameOrigin(request)) throw new AuthApiError("ORIGIN_NOT_ALLOWED", 403);
    await action();
  } catch (cause) {
    const error = cause instanceof AuthApiError
      ? cause
      : new AuthApiError("AUTH_SERVICE_UNAVAILABLE", 503);
    if (error.clearCookie) clearRefreshCookie(response);
    if (!response.writableEnded) sendJson(response, error.status, { success: false, code: error.code });
  }
}

export const handleAuthBootstrap: AuthHandler = async (request, response) => run(request, response, async () => {
  if (previewAuthDisabled()) throw new AuthApiError("PREVIEW_AUTH_DISABLED", 503);
  const body = BootstrapBodySchema.safeParse(await readJsonBody(request));
  if (!body.success) throw new AuthApiError("INVALID_REQUEST", 400);
  const session = await rotateAndVerify(body.data.refreshToken, response);
  sendJson(response, 200, { success: true, ...session });
});

export const handleAuthSession: AuthHandler = async (request, response) => run(request, response, async () => {
  if (previewAuthDisabled()) throw new AuthApiError("PREVIEW_AUTH_DISABLED", 503);
  const refreshToken = readRefreshCookie(request);
  if (!refreshToken || refreshToken.length > 4096) throw new AuthApiError("SESSION_EXPIRED", 401, Boolean(refreshToken));
  const session = await rotateAndVerify(refreshToken, response);
  sendJson(response, 200, { success: true, ...session });
});

export const handleAuthLogout: AuthHandler = async (request, response) => run(request, response, async () => {
  clearRefreshCookie(response);
  if (previewAuthDisabled()) {
    sendJson(response, 200, { success: true });
    return;
  }

  const hasBody = request.body !== undefined || Number(request.headers["content-length"] ?? 0) > 0;
  if (!hasBody) {
    sendJson(response, 200, { success: true });
    return;
  }

  let body: z.infer<typeof LogoutBodySchema>;
  try {
    body = LogoutBodySchema.parse(await readJsonBody(request));
  } catch {
    sendJson(response, 200, { success: true });
    return;
  }

  try {
    const config = getSupabaseConfig();
    await fetch(`${config.url}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: {
        apikey: config.publicKey,
        Authorization: `Bearer ${body.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Local logout remains complete even if remote revocation is temporarily unavailable.
  }
  sendJson(response, 200, { success: true });
});
