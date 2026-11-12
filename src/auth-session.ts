import { z } from "zod";

export type AuthRole = "super_admin" | "admin" | "reception" | "coach" | "content_manager";
export type AuthTokens = { accessToken: string; refreshToken?: string; expiresAt?: number };
export type AuthSession = AuthTokens & { displayName: string; role: AuthRole };
export type AuthConfig = { supabaseUrl: string; publicKey: string; staffTable: string };

const ProfileSchema = z.object({
  display_name: z.string().min(1),
  role: z.enum(["super_admin", "admin", "reception", "coach", "content_manager"]),
  active: z.literal(true),
});

const AuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  user: z.object({ id: z.string().uuid() }),
});
const StoredSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.number().positive().optional(),
}).passthrough();

function parseAuthTokens(payload: unknown) {
  const auth = AuthTokenResponseSchema.parse(payload);
  return {
    userId: auth.user.id,
    tokens: {
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      expiresAt: Date.now() + auth.expires_in * 1000,
    } satisfies AuthTokens,
  };
}

function persistTokens(tokens: AuthTokens) {
  sessionStorage.setItem("relaxfix-command-session", JSON.stringify({
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
  }));
}

async function loadStaffProfile(config: AuthConfig, tokens: AuthTokens, userId: string, signal?: AbortSignal): Promise<AuthSession> {
  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}/rest/v1/${encodeURIComponent(config.staffTable)}?id=eq.${encodeURIComponent(userId)}&select=display_name,role,active&limit=1`, {
      headers: { apikey: config.publicKey, Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (response.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!response.ok) throw new Error("PROFILE_CHECK_FAILED");
  const rows = z.array(ProfileSchema).parse(await response.json());
  if (rows.length !== 1) throw new Error("STAFF_ACCESS_DENIED");
  return { ...tokens, displayName: rows[0].display_name, role: rows[0].role };
}

export async function signInWithPassword(
  config: AuthConfig,
  email: string,
  password: string,
): Promise<AuthSession> {
  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.publicKey },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (response.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (response.status === 401 || response.status === 403) throw new Error("INVALID_LOGIN");
  if (response.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!response.ok) throw new Error("INVALID_LOGIN");
  const auth = parseAuthTokens(await response.json());
  return loadStaffProfile(config, auth.tokens, auth.userId);
}

async function requestRefreshedTokens(config: AuthConfig, refreshToken: string, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.publicKey },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal,
    });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (response.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (response.status === 400 || response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  if (response.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!response.ok) throw new Error("LOGIN_FAILED");
  return parseAuthTokens(await response.json());
}

export async function refreshAuthSession(
  config: AuthConfig,
  refreshToken: string,
  signal: AbortSignal | undefined,
  onTokensRotated?: (tokens: AuthTokens) => void,
): Promise<AuthSession> {
  const refreshed = await requestRefreshedTokens(config, refreshToken, signal);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  // Supabase refresh tokens are single-use: persist the rotated pair before profile verification.
  persistTokens(refreshed.tokens);
  onTokensRotated?.(refreshed.tokens);
  return loadStaffProfile(config, refreshed.tokens, refreshed.userId, signal);
}

export async function restoreAuthSession(
  config: AuthConfig,
  storedValue: unknown,
  signal: AbortSignal,
): Promise<AuthSession> {
  const stored = StoredSessionSchema.parse(storedValue);
  if (stored.refreshToken) {
    return refreshAuthSession(config, stored.refreshToken, signal);
  }
  // Compatibility for existing access-token-only browser sessions.
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.publicKey, Authorization: `Bearer ${stored.accessToken}`, Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("SESSION_EXPIRED");
  const user = z.object({ id: z.string().uuid() }).parse(await response.json());
  return loadStaffProfile(config, { accessToken: stored.accessToken }, user.id, signal);
}

export async function requestPasswordReset(config: AuthConfig, email: string, resetPath: string): Promise<void> {
  if (resetPath && !resetPath.startsWith("/")) throw new Error("CONFIGURATION_REQUIRED");
  const redirectTo = resetPath ? new URL(resetPath, window.location.origin).toString() : `${window.location.origin}/`;
  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.publicKey },
      body: JSON.stringify({ email, redirect_to: redirectTo }),
      cache: "no-store",
    });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (response.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (response.status === 401 || response.status === 403 || response.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!response.ok) throw new Error("LOGIN_FAILED");
}

export async function revokeLocalSession(config: AuthConfig, session: AuthTokens): Promise<void> {
  try {
    await fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: config.publicKey, Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    // Local sign-out must still complete if the network is unavailable.
  }
}
