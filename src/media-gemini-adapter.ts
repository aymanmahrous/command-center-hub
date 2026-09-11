import { analyzeMediaLocally, type MediaAnalysisResult } from "./media-ai-analysis";
import type { MediaAssetRecord } from "./media-types";

export type MediaAnalysisProviderResult = {
  analysis: MediaAnalysisResult;
  provider: "local_heuristic" | "gemini";
  providerConnected: boolean;
  integrationStatus: "CONNECTED" | "NOT CONNECTED";
  detail: string;
};

export function geminiIntegrationStatus(): { connected: false; detail: string } {
  return {
    connected: false,
    detail: "Gemini API requires server-side credentials — NOT CONNECTED in Command Center",
  };
}

export async function analyzeMediaWithProvider(
  asset: Pick<MediaAssetRecord, "assetType" | "category" | "metadata">,
): Promise<MediaAnalysisProviderResult> {
  const gemini = geminiIntegrationStatus();
  if (gemini.connected) {
    // Future: call approved server RPC only — never browser API keys.
    return {
      analysis: analyzeMediaLocally(asset),
      provider: "gemini",
      providerConnected: true,
      integrationStatus: "CONNECTED",
      detail: gemini.detail,
    };
  }

  return {
    analysis: analyzeMediaLocally(asset),
    provider: "local_heuristic",
    providerConnected: false,
    integrationStatus: "NOT CONNECTED",
    detail: gemini.detail,
  };
}
