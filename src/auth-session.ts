import { z } from "zod";

export type AuthRole = "super_admin" | "admin" | "reception" | "coach" | "content_manager";
export type AuthSession = {
  accessToken: string;
  expiresAt?: number;
  displayName: string;
  role: AuthRole;
};
export type AuthConfig = { supabaseUrl: string; publicKey: string; staffTable: string };

const ProfileSchema = z.object({
  display_name: z.string().min(1),
  role: z.enum(["super_admin", "admin", "reception", "coach", "content_manager"]),
  active: z.literal(true),
});
const AuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).max(4096),
  expires_in: z.number().positive(),
  user: z.object({ id: z.string().uuid() }),
});
const StoredSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).max(4096).optional(),
  expiresAt: z.number().positive().optional(),
}).passthrough();
const AuthApiSessionSchema = z.object({
  success: z.literal(true),
  accessToken: z.string().min(1),
  expiresAt: z.number().positive(),
  displayName: z.string().min(1),
  role: z.enum(["super_admin", "admin", "reception", "coach", "content_manager"]),
});

function authErrorFromResponse(status: number): Error {
  if (status === 401) return new Error("SESSION_EXPIRED");
  if (status === 403) return new Error("STAFF_ACCESS_DENIED");
  if (status === 429) return new Error("TOO_MANY_ATTEMPTS");
  if (status >= 500) return new Error("SERVICE_UNAVAILABLE");
  return new Error("LOGIN_FAILED");
}

async function postAuthApi(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<AuthSession> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (!response.ok) throw authErrorFromResponse(response.status);
  try {
    const payload = AuthApiSessionSchema.parse(await response.json());
    return {
      accessToken: payload.accessToken,
      expiresAt: payload.expiresAt,
      displayName: payload.displayName,
      role: payload.role,
    };
  } catch {
    throw new Error("LOGIN_FAILED");
  }
}

async function withAuthCookieLock<T>(action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("relaxfix-command-auth-cookie", { mode: "exclusive" }, action);
  }
  // Supabase's refresh-token reuse handling is the fallback for browsers without Web Locks.
  return action();
}

async function bootstrapSession(refreshToken: string, signal?: AbortSignal): Promise<AuthSession> {
  return withAuthCookieLock(() => postAuthApi("/api/auth/bootstrap", { refreshToken }, signal));
}

function jwtExpiry(accessToken: string): number | undefined {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof decoded.exp === "number" && decoded.exp > 0 ? decoded.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

async function loadStaffProfile(config: AuthConfig, accessToken: string, userId: string, signal?: AbortSignal): Promise<AuthSession> {
  let response: Response;
  try {
    response = await fetch(
      `${config.supabaseUrl}/rest/v1/${encodeURIComponent(config.staffTable)}?id=eq.${encodeURIComponent(userId)}&select=display_name,role,active&limit=1`,
      {
        headers: { apikey: config.publicKey, Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
        signal,
      },
    );
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (response.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (response.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!response.ok) throw new Error("PROFILE_CHECK_FAILED");
  const rows = z.array(ProfileSchema).parse(await response.json());
  if (rows.length !== 1) throw new Error("STAFF_ACCESS_DENIED");
  return {
    accessToken,
    expiresAt: jwtExpiry(accessToken),
    displayName: rows[0].display_name,
    role: rows[0].role,
  };
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

  const auth = AuthTokenResponseSchema.parse(await response.json());
  // The refresh token exists only in memory for this handoff; the server stores it in an HttpOnly cookie.
  return bootstrapSession(auth.refresh_token);
}

export async function refreshAuthSession(signal?: AbortSignal): Promise<AuthSession> {
  return withAuthCookieLock(() => postAuthApi("/api/auth/session", {}, signal));
}

export async function restoreAuthSession(
  config: AuthConfig,
  storedValue: unknown,
  signal: AbortSignal,
): Promise<AuthSession> {
  if (storedValue === null || storedValue === undefined) return refreshAuthSession(signal);

  const stored = StoredSessionSchema.parse(storedValue);
  if (stored.refreshToken) return bootstrapSession(stored.refreshToken, signal);

  // One-time compatibility for older access-token-only sessions. They remain memory-only after validation.
  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.publicKey, Authorization: `Bearer ${stored.accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  if (response.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (response.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!response.ok) throw new Error("PROFILE_CHECK_FAILED");
  const user = z.object({ id: z.string().uuid() }).parse(await response.json());
  const profile = await loadStaffProfile(config, stored.accessToken, user.id, signal);
  return { ...profile, expiresAt: stored.expiresAt ?? profile.expiresAt };
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

export async function revokeLocalSession(session: AuthSession): Promise<void> {
  await withAuthCookieLock(async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ accessToken: session.accessToken }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("LOGOUT_UNAVAILABLE");
  });
}
