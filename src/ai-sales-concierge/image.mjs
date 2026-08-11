import { buildSalesConciergeTurn } from "./logic.mjs";
import { createOpenAiVisionAdapter, isOpenAiVisionCredentialPresent, OPENAI_VISION_PROVIDER_ID } from "./openai-vision.mjs";
import { applyVisionToConciergeInput, understandWhatsAppImage } from "./vision.mjs";

function resolveVisionOptions(options = {}) {
  if (options.adapters && options.providerId) return options;

  const adapters = { ...(options.adapters || {}) };
  if (!adapters[OPENAI_VISION_PROVIDER_ID]) {
    adapters[OPENAI_VISION_PROVIDER_ID] = createOpenAiVisionAdapter({
      apiKey: options.apiKey,
      fetchImpl: options.fetchImpl,
      model: options.model,
    });
  }

  return {
    ...options,
    providerId: options.providerId || OPENAI_VISION_PROVIDER_ID,
    adapters,
  };
}

/**
 * Phase 6E image turn with OpenAI Vision preferred:
 * image (+ optional caption) → OpenAI Vision (if OPENAI_API_KEY present) → existing concierge → draft only.
 * Falls back to caption / Phase 6C image prompt when vision is unavailable.
 */
export async function buildImageConciergeTurn(input = {}, options = {}) {
  const visionOptions = resolveVisionOptions(options);

  // If credential is absent and caller did not inject an adapter, keep caption/metadata fallback.
  if (!options.adapters && !isOpenAiVisionCredentialPresent() && options.apiKey == null) {
    visionOptions.providerId = null;
  }

  const vision = await understandWhatsAppImage(
    {
      imageBytes: input.imageBytes,
      imageUrl: input.imageUrl,
      mimeType: input.mimeType,
      caption: input.caption,
      languageHint: input.languageHint || input.language,
      mediaId: input.mediaId,
      messageId: input.messageId,
      conversationId: input.conversationId,
    },
    visionOptions,
  );

  const conciergeInput = applyVisionToConciergeInput(
    {
      channel: input.channel || "whatsapp",
      mode: input.mode || "ai_active",
      language: input.language || "en",
      messageBody: input.messageBody || "[Customer sent an image]",
      safetyClassification: input.safetyClassification || "whatsapp_image",
      caption: input.caption ?? null,
      intent: input.intent,
      service: input.service,
      stage: input.stage || "new",
      score: input.score ?? 0,
      fearOfWater: input.fearOfWater ?? null,
      humanRequired: input.humanRequired ?? false,
      recentMessages: input.recentMessages || [],
    },
    vision,
  );

  const turn = buildSalesConciergeTurn(conciergeInput);

  return {
    ...turn,
    vision,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    outboundEnabled: false,
  };
}
