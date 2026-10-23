function legacyKeyRole(key: string): string | null {
  try {
    const encodedPayload = key.split(".")[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/").padEnd(encodedPayload.length + 3 & -4, "=");
    const payload = JSON.parse(atob(normalized)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function browserSafeApiKey(key: string): boolean {
  const normalizedKey = key.trim();
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(normalizedKey)) return true;
  if (normalizedKey.startsWith("sb_secret_")) return false;
  return legacyKeyRole(normalizedKey) === "anon";
}

export function isSupabaseBrowserConfigurationReady(urlValue: string, publicKeyValue: string, staffTableValue: string): boolean {
  const normalizedUrl = urlValue.trim().replace(/\/$/, "");
  const publicKey = publicKeyValue.trim();
  const staffTable = staffTableValue.trim();

  try {
    const url = new URL(normalizedUrl);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && browserSafeApiKey(publicKey) && staffTable.length > 0;
  } catch {
    return false;
  }
}
