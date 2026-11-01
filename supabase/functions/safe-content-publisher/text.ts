export function normalizeHashtag(tag: unknown): string {
  const value = String(tag ?? "").trim().replace(/^#+/, "");
  return value ? `#${value}` : "";
}

export function formatHashtags(tags: unknown): string {
  if (!Array.isArray(tags)) return "";
  return tags.map(normalizeHashtag).filter(Boolean).join(" ");
}
