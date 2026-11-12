import { z } from "zod";

export type AuthTokens = { accessToken: string; refreshToken?: string; expiresAt?: number };
export type AuthConfig = { supabaseUrl: string; publicKey: string; staffTable: string };
export type AuthProfileLoader<TSession extends AuthTokens> = (tokens: AuthTokens, userId: string, signal?: AbortSignal) => Promise<TSession>;

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

export async function signInWithPassword<TSession extends AuthTokens>(
  config: AuthConfig,
  email: string,
  password: string,
  loadStaffProfile: AuthProfileLoader<TSession>,
): Promise<TSession> {
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
  return loadStaffProfile(auth.tokens, auth.userId);
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

export async function refreshAuthSession<TSession extends AuthTokens>(
  config: AuthConfig,
  refreshToken: string,
  signal: AbortSignal | undefined,
  loadStaffProfile: AuthProfileLoader<TSession>,
  onTokensRotated?: (tokens: AuthTokens) => void,
): Promise<TSession> {
  const refreshed = await requestRefreshedTokens(config, refreshToken, signal);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  // Supabase refresh tokens are single-use: persist the rotated pair before profile verification.
  onTokensRotated?.(refreshed.tokens);
  return loadStaffProfile(refreshed.tokens, refreshed.userId, signal);
}

export async function restoreAuthSession<TSession extends AuthTokens>(
  config: AuthConfig,
  storedValue: unknown,
  signal: AbortSignal,
  loadStaffProfile: AuthProfileLoader<TSession>,
  onTokensRotated?: (tokens: AuthTokens) => void,
): Promise<TSession> {
  const stored = StoredSessionSchema.parse(storedValue);
  if (stored.refreshToken) {
    return refreshAuthSession(config, stored.refreshToken, signal, loadStaffProfile, onTokensRotated);
  }
  // Compatibility for existing access-token-only browser sessions.
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.publicKey, Authorization: `Bearer ${stored.accessToken}`, Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("SESSION_EXPIRED");
  const user = z.object({ id: z.string().uuid() }).parse(await response.json());
  return loadStaffProfile({ accessToken: stored.accessToken }, user.id, signal);
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
