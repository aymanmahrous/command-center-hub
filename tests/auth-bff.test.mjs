import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { afterEach } from "node:test";
import { handleAuthBootstrap, handleAuthSession, handleAuthLogout } from "../server/auth.ts";

const originalFetch = globalThis.fetch;
const envKeys = ["VERCEL_ENV", "AUTH_BFF_PREVIEW_ENABLED", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "VITE_STAFF_PROFILE_TABLE"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function configureEnv(environment = "production") {
  process.env.VERCEL_ENV = environment;
  delete process.env.AUTH_BFF_PREVIEW_ENABLED;
  process.env.SUPABASE_URL = "https://command-center-test.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key_12345678901234567890";
  process.env.VITE_STAFF_PROFILE_TABLE = "staff_profiles";
}

function restoreEnv() {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
}
afterEach(restoreEnv);

async function withServer(handler, action) {
  const server = createServer((request, response) => {
    void handler(request, response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await action(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function installFetchMock(baseUrl, mock) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith(baseUrl)) return originalFetch(input, init);
    calls.push({ url, init });
    return mock(url, init);
  };
  return calls;
}

function browserHeaders(baseUrl, extra = {}) {
  const host = new URL(baseUrl).host;
  return {
    Origin: `https://${host}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function tokenResponse(refreshToken = "rotated-refresh-token") {
  return new Response(JSON.stringify({
    access_token: "short-lived-access-token",
    refresh_token: refreshToken,
    expires_in: 3600,
    user: { id: "11111111-1111-4111-8111-111111111111" },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function profileResponse(rows = [{ display_name: "Coach", role: "super_admin", active: true }], status = 200) {
  return new Response(JSON.stringify(rows), { status, headers: { "Content-Type": "application/json" } });
}

test("bootstrap rotates the refresh token into an HttpOnly host-only cookie and returns no refresh token", async () => {
  configureEnv();
  await withServer(handleAuthBootstrap, async (baseUrl) => {
    const calls = installFetchMock(baseUrl, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=refresh_token")) return tokenResponse();
      if (url.includes("/rest/v1/staff_profiles")) return profileResponse();
      throw new Error("Unexpected upstream request");
    });
    const response = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: "POST",
      headers: browserHeaders(baseUrl),
      body: JSON.stringify({ refreshToken: "legacy-refresh-token" }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.accessToken, "short-lived-access-token");
    assert.equal(payload.role, "super_admin");
    assert.equal("refreshToken" in payload, false);
    assert.equal(JSON.stringify(payload).includes("rotated-refresh-token"), false);
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /__Secure-relaxfix-command-refresh=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\/api\/auth/);
    assert.doesNotMatch(cookie, /Domain=/i);
    const refreshCall = calls.find((call) => call.url.includes("/auth/v1/token"));
    assert.equal(JSON.parse(refreshCall.init.body).refresh_token, "legacy-refresh-token");
    const profileCall = calls.find((call) => call.url.includes("/rest/v1/staff_profiles"));
    assert.equal(profileCall.init.headers.Authorization, "Bearer short-lived-access-token");
  });
});

test("cookie session refresh uses the HttpOnly cookie and returns a new memory-only access token", async () => {
  configureEnv();
  await withServer(handleAuthSession, async (baseUrl) => {
    const calls = installFetchMock(baseUrl, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=refresh_token")) return tokenResponse("next-refresh-token");
      if (url.includes("/rest/v1/staff_profiles")) return profileResponse();
      throw new Error("Unexpected upstream request");
    });
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: browserHeaders(baseUrl, { Cookie: "__Secure-relaxfix-command-refresh=previous-refresh-token" }),
      body: "{}",
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.accessToken, "short-lived-access-token");
    assert.equal("refreshToken" in payload, false);
    assert.match(response.headers.get("set-cookie") ?? "", /next-refresh-token/);
    assert.equal(JSON.parse(calls[0].init.body).refresh_token, "previous-refresh-token");
  });
});

test("cross-origin requests are rejected before contacting Supabase", async () => {
  configureEnv();
  await withServer(handleAuthBootstrap, async (baseUrl) => {
    const calls = installFetchMock(baseUrl, async () => { throw new Error("Upstream must not be called"); });
    const response = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: "POST",
      headers: browserHeaders(baseUrl, { Origin: "https://attacker.example" }),
      body: JSON.stringify({ refreshToken: "must-not-be-used" }),
    });
    assert.equal(response.status, 403);
    assert.equal(calls.length, 0);
  });
});

test("Preview auth is blocked before any Supabase request when Preview points at the production project", async () => {
  configureEnv("preview");
  await withServer(handleAuthSession, async (baseUrl) => {
    const calls = installFetchMock(baseUrl, async () => { throw new Error("Preview must not call Supabase"); });
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: browserHeaders(baseUrl, { Cookie: "__Secure-relaxfix-command-refresh=production-cookie" }),
      body: "{}",
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "PREVIEW_AUTH_DISABLED");
    assert.equal(calls.length, 0);
  });
});

test("invalid refresh tokens clear only the auth cookie and return a safe expiry code", async () => {
  configureEnv();
  await withServer(handleAuthSession, async (baseUrl) => {
    installFetchMock(baseUrl, async () => new Response("{}", { status: 400 }));
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: browserHeaders(baseUrl, { Cookie: "__Secure-relaxfix-command-refresh=invalid-token" }),
      body: "{}",
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "SESSION_EXPIRED");
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });
});

test("a transient profile failure keeps the newly rotated cookie recoverable", async () => {
  configureEnv();
  await withServer(handleAuthBootstrap, async (baseUrl) => {
    installFetchMock(baseUrl, async (url) => {
      if (url.includes("/auth/v1/token?grant_type=refresh_token")) return tokenResponse("recoverable-refresh-token");
      if (url.includes("/rest/v1/staff_profiles")) return profileResponse([], 503);
      throw new Error("Unexpected upstream request");
    });
    const response = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: "POST",
      headers: browserHeaders(baseUrl),
      body: JSON.stringify({ refreshToken: "old-refresh-token" }),
    });
    assert.equal(response.status, 503);
    assert.match(response.headers.get("set-cookie") ?? "", /recoverable-refresh-token/);
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });
});

test("logout clears the cookie before attempting local-scope Supabase revocation", async () => {
  configureEnv();
  await withServer(handleAuthLogout, async (baseUrl) => {
    const calls = installFetchMock(baseUrl, async (url, init) => {
      assert.match(url, /\/auth\/v1\/logout\?scope=local/);
      assert.equal(init.headers.Authorization, "Bearer current-access-token");
      return new Response(null, { status: 204 });
    });
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: browserHeaders(baseUrl),
      body: JSON.stringify({ accessToken: "current-access-token" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
    assert.equal(calls.length, 1);
  });
});
