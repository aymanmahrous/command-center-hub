export type GeminiUsageSummary = {
  requestedModel: string;
  modelVersion: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
  totalTokens: number | null;
  toolUsePromptTokens: number | null;
  groundingSearchQueries: number | null;
  estimatedTokenCostUsd: number | null;
  pricingStatus: "estimated" | "unavailable";
  pricingAsOf: string;
  pricingEffectiveFrom: string | null;
  pricingEffectiveThrough: string | null;
  inputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
  pricingSource: string;
  groundingFeeIncluded: false;
  groundingQuotaStatus: "unknown";
};

type UsageMetadata = {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  thoughtsTokenCount?: unknown;
  totalTokenCount?: unknown;
  toolUsePromptTokenCount?: unknown;
};

type Rate = {
  effectiveFrom: string;
  effectiveThrough: string | null;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";
const RATES: Rate[] = [
  { effectiveFrom: "2026-08-13", effectiveThrough: "2026-12-31", inputUsdPerMillion: 0.75, outputUsdPerMillion: 3.75 },
  { effectiveFrom: "2027-01-01", effectiveThrough: null, inputUsdPerMillion: 1.5, outputUsdPerMillion: 7.5 },
];

function safeTokenCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizeSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function ratesFor(model: string, date: string): Rate | null {
  const normalized = model.trim().toLowerCase();
  if (normalized !== "gemini-3.7-flash" && !normalized.startsWith("gemini-3.7-flash-")) return null;
  return RATES.find((rate) => date >= rate.effectiveFrom && (!rate.effectiveThrough || date <= rate.effectiveThrough)) ?? null;
}

function uniqueSearchQueryCount(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  const queries = value.flatMap((entry) => {
    if (typeof entry === "string") {
      const normalized = normalizeSearchQuery(entry);
      return normalized ? [normalized] : [];
    }
    if (entry && typeof entry === "object") {
      const record = entry as { query?: unknown; value?: unknown; text?: unknown };
      const candidate = typeof record.query === "string" ? record.query : typeof record.value === "string" ? record.value : typeof record.text === "string" ? record.text : "";
      const normalized = normalizeSearchQuery(candidate);
      return normalized ? [normalized] : [];
    }
    return [];
  });
  return new Set(queries).size;
}

export function buildGeminiUsageSummary(input: {
  requestedModel: string;
  modelVersion?: unknown;
  metadata?: unknown;
  webSearchQueries?: unknown;
  now?: Date;
}): GeminiUsageSummary {
  const now = input.now ?? new Date();
  const pricingAsOf = now.toISOString().slice(0, 10);
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? input.metadata as UsageMetadata
    : {};
  const inputTokens = safeTokenCount(metadata.promptTokenCount);
  const outputTokens = safeTokenCount(metadata.candidatesTokenCount);
  const thinkingTokens = safeTokenCount(metadata.thoughtsTokenCount);
  const providerTotalTokens = safeTokenCount(metadata.totalTokenCount);
  const totalTokens = providerTotalTokens ?? (
    inputTokens !== null && outputTokens !== null && thinkingTokens !== null
      ? inputTokens + outputTokens + thinkingTokens
      : null
  );
  const rates = ratesFor(input.requestedModel, pricingAsOf);
  const estimatedTokenCostUsd = rates && inputTokens !== null && outputTokens !== null && thinkingTokens !== null
    ? (inputTokens * rates.inputUsdPerMillion + (outputTokens + thinkingTokens) * rates.outputUsdPerMillion) / 1_000_000
    : null;
  const modelVersion = typeof input.modelVersion === "string" && input.modelVersion.trim()
    ? input.modelVersion.trim().slice(0, 120)
    : null;

  return {
    requestedModel: input.requestedModel,
    modelVersion,
    inputTokens,
    outputTokens,
    thinkingTokens,
    totalTokens,
    toolUsePromptTokens: safeTokenCount(metadata.toolUsePromptTokenCount),
    groundingSearchQueries: uniqueSearchQueryCount(input.webSearchQueries),
    estimatedTokenCostUsd,
    pricingStatus: estimatedTokenCostUsd === null ? "unavailable" : "estimated",
    pricingAsOf,
    pricingEffectiveFrom: rates?.effectiveFrom ?? null,
    pricingEffectiveThrough: rates?.effectiveThrough ?? null,
    inputUsdPerMillion: rates?.inputUsdPerMillion ?? null,
    outputUsdPerMillion: rates?.outputUsdPerMillion ?? null,
    pricingSource: PRICING_SOURCE,
    groundingFeeIncluded: false,
    groundingQuotaStatus: "unknown",
  };
}
