export type ProviderKey = "gemini" | "canva" | "runway" | "capcut" | "buffer" | "n8n";

export type ProviderStatus = {
  key: ProviderKey;
  connected: boolean;
  detail: string;
};

const DEFAULT_STATUSES: Record<ProviderKey, ProviderStatus> = {
  gemini: { key: "gemini", connected: false, detail: "Gemini — NEEDS CREDENTIAL (set GEMINI_API_KEY in Supabase Edge Function secrets)" },
  canva: { key: "canva", connected: false, detail: "Canva — NOT CONNECTED (adapter ready for future OAuth)" },
  runway: { key: "runway", connected: false, detail: "Runway — NOT CONNECTED (adapter ready for future API key)" },
  capcut: { key: "capcut", connected: false, detail: "CapCut — manual workflow only (no API connected)" },
  buffer: { key: "buffer", connected: false, detail: "Buffer — NOT CONNECTED (publishing blocked in this phase)" },
  n8n: { key: "n8n", connected: false, detail: "n8n — design-only hooks (no live execution from Media Library)" },
};

export function readMediaProviderStatuses(flags: Partial<Record<ProviderKey, boolean>> = {}): ProviderStatus[] {
  return (Object.keys(DEFAULT_STATUSES) as ProviderKey[]).map((key) => {
    if (flags[key] === true) return { ...DEFAULT_STATUSES[key], connected: true, detail: `${key} reported connected` };
    return DEFAULT_STATUSES[key];
  });
}

export type FallbackAssetPlan = {
  source: "pending";
  providers: ProviderKey[];
  status: "NOT_CONNECTED";
  canvaBrief: string;
  runwayBrief?: string;
  capcutBrief: string;
  geminiBrief?: string;
  note: string;
};

export function buildFallbackAssetPlan(contentType: string, topic: string): FallbackAssetPlan {
  const isVideo = /reel|video/i.test(contentType);
  return {
    source: "pending",
    providers: isVideo ? ["canva", "runway", "capcut"] : ["canva"],
    status: "NOT_CONNECTED",
    canvaBrief: `Design static or carousel frames for: ${topic}`,
    runwayBrief: isVideo ? `Optional b-roll generation for: ${topic}` : undefined,
    capcutBrief: isVideo ? `Vertical edit with hook in first 2 seconds for: ${topic}` : "Not required for static post",
    geminiBrief: "Gemini API NOT CONNECTED — use local analysis only",
    note: "No suitable Swimming Business media found. Fallback asset plan prepared; external providers remain NOT CONNECTED.",
  };
}
