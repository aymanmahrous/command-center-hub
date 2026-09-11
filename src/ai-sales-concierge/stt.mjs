/**
 * Phase 6D — provider-agnostic STT interface (repo foundation only).
 *
 * No paid provider is selected or enabled here.
 * Owner must approve one STT credential before Production wiring.
 *
 * Supported contract:
 *   input:  { audioBytes|audioUrl, mimeType, languageHint?, mediaId?, messageId?, conversationId? }
 *   output: { ok, provider, text|null, language|null, code, error|null }
 *
 * Never fabricates a transcription. Empty/unsupported audio returns a typed failure.
 */

export const STT_PROVIDER_REQUIREMENT = {
  status: "OWNER_SETUP_REQUIRED",
  // Preferred by owner direction (Phase 6D). Remains inactive until credentials exist.
  preferredProvider: "google_speech_to_text_v2",
  approvedProvider: null,
  candidates: [
    {
      id: "google_speech_to_text_v2",
      label: "Google Cloud Speech-to-Text V2 (Chirp 3)",
      preferred: true,
      credential: "GOOGLE_SPEECH_CREDENTIALS_JSON",
      projectId: "GOOGLE_CLOUD_PROJECT_ID",
      languages: ["ar-AE", "ar-EG", "en-US"],
      model: "chirp_3",
      notes: "Preferred for short WhatsApp voice notes. Requires Speech-to-Text API enabled by owner.",
    },
    {
      id: "openai_whisper",
      label: "OpenAI Whisper (whisper-1 / gpt-4o-transcribe)",
      preferred: false,
      credential: "OPENAI_API_KEY",
      notes: "Fallback candidate only. Not selected while Google STT V2 is preferred.",
    },
  ],
  productionChanged: false,
  outboundEnabled: false,
};

const SUPPORTED_AUDIO_MIME = new Set([
  "audio/ogg",
  "audio/opus",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/aac",
]);

export function normalizeLanguageHint(hint) {
  if (!hint) return null;
  const value = String(hint).trim().toLowerCase();
  if (value.startsWith("ar")) return "ar";
  if (value.startsWith("en")) return "en";
  return null;
}

export function detectTranscriptionLanguage(text) {
  if (!text || !String(text).trim()) return null;
  return /[ء-ي]/.test(text) ? "ar" : "en";
}

/**
 * Validates audio input before any provider call.
 * Does not call network or invent text.
 */
export function validateAudioForStt(input = {}) {
  const mimeType = (input.mimeType || "").toLowerCase();
  const hasBytes = Boolean(input.audioBytes && (input.audioBytes.byteLength > 0 || input.audioBytes.length > 0));
  const hasUrl = Boolean(input.audioUrl && String(input.audioUrl).trim());

  if (!hasBytes && !hasUrl) {
    return { ok: false, code: "EMPTY_AUDIO", error: "No audio bytes or URL provided." };
  }
  if (mimeType && !SUPPORTED_AUDIO_MIME.has(mimeType) && !mimeType.startsWith("audio/")) {
    return { ok: false, code: "UNSUPPORTED_AUDIO", error: `Unsupported mime type: ${mimeType}` };
  }
  if (mimeType && !SUPPORTED_AUDIO_MIME.has(mimeType) && mimeType.startsWith("audio/") === false) {
    return { ok: false, code: "UNSUPPORTED_AUDIO", error: `Unsupported mime type: ${mimeType}` };
  }
  return {
    ok: true,
    code: "READY",
    mimeType: mimeType || null,
    languageHint: normalizeLanguageHint(input.languageHint),
    mediaId: input.mediaId ?? null,
    messageId: input.messageId ?? null,
    conversationId: input.conversationId ?? null,
  };
}

/**
 * Provider adapter stub.
 * Until owner approves a credential, this never invents text.
 */
export async function transcribeWhatsAppAudio(input = {}, options = {}) {
  const validation = validateAudioForStt(input);
  if (!validation.ok) {
    return {
      ok: false,
      provider: null,
      text: null,
      language: null,
      code: validation.code,
      error: validation.error,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      mediaId: input.mediaId ?? null,
    };
  }

  const providerId = options.providerId || STT_PROVIDER_REQUIREMENT.approvedProvider;
  if (!providerId) {
    return {
      ok: false,
      provider: null,
      text: null,
      language: null,
      code: "STT_PROVIDER_NOT_CONFIGURED",
      error: "No approved STT provider/credential. Owner approval required.",
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
      requirement: STT_PROVIDER_REQUIREMENT,
    };
  }

  const adapter = options.adapters?.[providerId];
  if (!adapter || typeof adapter.transcribe !== "function") {
    return {
      ok: false,
      provider: providerId,
      text: null,
      language: null,
      code: "STT_ADAPTER_MISSING",
      error: `No adapter registered for provider: ${providerId}`,
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
    };
  }

  let result;
  try {
    result = await adapter.transcribe({
      audioBytes: input.audioBytes,
      audioUrl: input.audioUrl,
      mimeType: validation.mimeType,
      languageHint: validation.languageHint,
    });
  } catch (error) {
    return {
      ok: false,
      provider: providerId,
      text: null,
      language: null,
      code: "TRANSCRIPTION_FAILED",
      error: error instanceof Error ? error.message : "Transcription provider error",
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
    };
  }

  const text = typeof result?.text === "string" ? result.text.trim() : "";
  if (!text) {
    return {
      ok: false,
      provider: providerId,
      text: null,
      language: null,
      code: "TRANSCRIPTION_EMPTY",
      error: "Provider returned empty transcription.",
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
    };
  }

  return {
    ok: true,
    provider: providerId,
    text,
    language: detectTranscriptionLanguage(text) || validation.languageHint,
    code: "TRANSCRIPTION_OK",
    error: null,
    conversationId: validation.conversationId,
    messageId: validation.messageId,
    mediaId: validation.mediaId,
  };
}

/**
 * Maps STT result into concierge turn input.
 * Successful text replaces the audio placeholder; failures keep typed failure state.
 */
export function applyTranscriptionToConciergeInput(baseInput, transcription) {
  if (!transcription?.ok || !transcription.text) {
    return {
      ...baseInput,
      safetyClassification: baseInput.safetyClassification ?? "whatsapp_audio",
      messageBody: baseInput.messageBody || "[Customer sent a voice note]",
      transcriptionStatus: transcription?.code || "TRANSCRIPTION_FAILED",
      transcriptionText: null,
    };
  }

  return {
    ...baseInput,
    safetyClassification: null,
    messageBody: transcription.text,
    transcriptionStatus: "TRANSCRIPTION_OK",
    transcriptionText: transcription.text,
    language: transcription.language || baseInput.language,
  };
}
