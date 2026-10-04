export type GeminiUsageMetadata = {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  totalTokenCount?: unknown;
};

export type CoachBrainCostTransparency = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  pricingConfigured: boolean;
  estimatedCostUsd: number | null;
  pricingSource: string;
};

type Pricing = {
  inputUsdPerMillionTokens?: unknown;
  outputUsdPerMillionTokens?: unknown;
};

function nonNegativeInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function nonNegativeRate(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function buildCostTransparency(
  model: string,
  usage: GeminiUsageMetadata | null | undefined,
  pricing: Pricing = {},
): CoachBrainCostTransparency {
  const inputTokens = nonNegativeInteger(usage?.promptTokenCount);
  const outputTokens = nonNegativeInteger(usage?.candidatesTokenCount);
  const reportedTotal = nonNegativeInteger(usage?.totalTokenCount);
  const totalTokens = reportedTotal ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  const inputRate = nonNegativeRate(pricing.inputUsdPerMillionTokens);
  const outputRate = nonNegativeRate(pricing.outputUsdPerMillionTokens);
  const pricingConfigured = inputRate !== null && outputRate !== null;
  const estimatedCostUsd = pricingConfigured && inputTokens !== null && outputTokens !== null
    ? Number(((inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate).toFixed(8))
    : null;

  return {
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    pricingConfigured,
    estimatedCostUsd,
    pricingSource: pricingConfigured
      ? "Supabase Edge Function pricing environment variables"
      : "Pricing not configured; token usage is shown without inventing a price",
  };
}

export function pricingFromEnvironment(getEnv: (name: string) => string | undefined): Pricing {
  return {
    inputUsdPerMillionTokens: getEnv("COACH_BRAIN_INPUT_USD_PER_MILLION_TOKENS"),
    outputUsdPerMillionTokens: getEnv("COACH_BRAIN_OUTPUT_USD_PER_MILLION_TOKENS"),
  };
}
