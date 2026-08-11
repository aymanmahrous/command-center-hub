import { buildSalesConciergeTurn } from "./logic.mjs";
import { applyVisionToConciergeInput, understandWhatsAppImage } from "./vision.mjs";

/**
 * Phase 6E image turn foundation:
 * image (+ optional caption) → vision adapter (if approved) → existing concierge → draft only.
 * Falls back to caption / Phase 6C image prompt when vision is unavailable.
 */
export async function buildImageConciergeTurn(input = {}, options = {}) {
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
    options,
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
