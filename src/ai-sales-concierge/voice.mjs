import { buildSalesConciergeTurn } from "./logic.mjs";
import { applyTranscriptionToConciergeInput, transcribeWhatsAppAudio } from "./stt.mjs";

/**
 * Phase 6D voice turn foundation:
 * voice/audio → STT adapter (if approved) → existing concierge → draft only.
 * Never sends outbound messages.
 */
export async function buildVoiceConciergeTurn(input = {}, options = {}) {
  const transcription = await transcribeWhatsAppAudio(
    {
      audioBytes: input.audioBytes,
      audioUrl: input.audioUrl,
      mimeType: input.mimeType,
      languageHint: input.languageHint || input.language,
      mediaId: input.mediaId,
      messageId: input.messageId,
      conversationId: input.conversationId,
    },
    options,
  );

  const conciergeInput = applyTranscriptionToConciergeInput(
    {
      channel: input.channel || "whatsapp",
      mode: input.mode || "ai_active",
      language: input.language || "en",
      messageBody: input.messageBody || "[Customer sent a voice note]",
      safetyClassification: input.safetyClassification || "whatsapp_audio",
      intent: input.intent,
      service: input.service,
      stage: input.stage || "new",
      score: input.score ?? 0,
      fearOfWater: input.fearOfWater ?? null,
      humanRequired: input.humanRequired ?? false,
      recentMessages: input.recentMessages || [],
    },
    transcription,
  );

  const turn = buildSalesConciergeTurn(conciergeInput);

  return {
    ...turn,
    transcription,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    outboundEnabled: false,
  };
}
