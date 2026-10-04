import assert from "node:assert/strict";
import test from "node:test";
import { buildCostTransparency, pricingFromEnvironment } from "../supabase/functions/coach-brain-research/cost.ts";

test("Coach Brain calculates transparent token usage and configured estimated cost", () => {
  const result = buildCostTransparency("gemini-3.7-flash", {
    promptTokenCount: 1_000,
    candidatesTokenCount: 2_000,
    totalTokenCount: 3_000,
  }, {
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.4,
  });
  assert.deepEqual(result, {
    model: "gemini-3.7-flash",
    inputTokens: 1_000,
    outputTokens: 2_000,
    totalTokens: 3_000,
    pricingConfigured: true,
    estimatedCostUsd: 0.0009,
    pricingSource: "Supabase Edge Function pricing environment variables",
  });
});

test("missing pricing never invents a dollar amount", () => {
  const result = buildCostTransparency("gemini-3.7-flash", { promptTokenCount: 12, candidatesTokenCount: 8 });
  assert.equal(result.totalTokens, 20);
  assert.equal(result.pricingConfigured, false);
  assert.equal(result.estimatedCostUsd, null);
  assert.match(result.pricingSource, /not configured/i);
});

test("malformed provider usage is fail-closed and never negative", () => {
  const result = buildCostTransparency("gemini-3.7-flash", {
    promptTokenCount: -1,
    candidatesTokenCount: "not-a-number",
    totalTokenCount: 99.5,
  }, { inputUsdPerMillionTokens: -1, outputUsdPerMillionTokens: 0.4 });
  assert.deepEqual(result, {
    model: "gemini-3.7-flash",
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    pricingConfigured: false,
    estimatedCostUsd: null,
    pricingSource: "Pricing not configured; token usage is shown without inventing a price",
  });
});

test("pricing reads only server-side environment names", () => {
  const pricing = pricingFromEnvironment((name) => ({
    COACH_BRAIN_INPUT_USD_PER_MILLION_TOKENS: "0.2",
    COACH_BRAIN_OUTPUT_USD_PER_MILLION_TOKENS: "0.8",
  }[name]));
  assert.deepEqual(pricing, { inputUsdPerMillionTokens: "0.2", outputUsdPerMillionTokens: "0.8" });
});
