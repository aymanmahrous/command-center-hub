/**
 * Phase 6E — provider-agnostic image understanding interface (repo only).
 *
 * No vision provider is selected or activated here.
 * Existing Phase 6C caption/metadata path remains the safe fallback.
 *
 * Contract:
 *   input:  { imageBytes|imageUrl, mimeType?, caption?, languageHint?, mediaId?, messageId?, conversationId? }
 *   output: { ok, provider, description|null, language|null, code, error|null }
 *
 * Never fabricates image understanding.
 */

export const VISION_PROVIDER_REQUIREMENT = {
  status: "OWNER_APPROVAL_REQUIRED",
  approvedProvider: null,
  preferredProvider: null,
  candidates: [
    {
      id: "openai_vision",
      label: "OpenAI Vision (gpt-4o / gpt-4.1)",
      credential: "OPENAI_API_KEY",
      notes: "Vision-capable chat completions. Not selected or enabled in this phase.",
    },
    {
      id: "google_gemini_vision",
      label: "Google Gemini multimodal",
      credential: "GOOGLE_GEMINI_API_KEY",
      notes: "Separate from Google Speech-to-Text. Not selected or enabled in this phase.",
    },
  ],
  productionChanged: false,
  outboundEnabled: false,
};

const SUPPORTED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function normalizeVisionLanguageHint(hint) {
  if (!hint) return null;
  const value = String(hint).trim().toLowerCase();
  if (value.startsWith("ar")) return "ar";
  if (value.startsWith("en")) return "en";
  return null;
}

export function detectVisionLanguage(text) {
  if (!text || !String(text).trim()) return null;
  return /[ء-ي]/.test(text) ? "ar" : "en";
}

export function validateImageForVision(input = {}) {
  const mimeType = (input.mimeType || "").toLowerCase();
  const hasBytes = Boolean(input.imageBytes && (input.imageBytes.byteLength > 0 || input.imageBytes.length > 0));
  const hasUrl = Boolean(input.imageUrl && String(input.imageUrl).trim());
  const caption = typeof input.caption === "string" ? input.caption.trim() : "";

  if (!hasBytes && !hasUrl && !caption) {
    return { ok: false, code: "MISSING_MEDIA", error: "No image bytes, URL, or caption provided." };
  }

  if ((hasBytes || hasUrl) && mimeType && !SUPPORTED_IMAGE_MIME.has(mimeType) && !mimeType.startsWith("image/")) {
    return { ok: false, code: "UNSUPPORTED_IMAGE", error: `Unsupported mime type: ${mimeType}` };
  }

  return {
    ok: true,
    code: "READY",
    mimeType: mimeType || null,
    caption: caption || null,
    languageHint: normalizeVisionLanguageHint(input.languageHint),
    mediaId: input.mediaId ?? null,
    messageId: input.messageId ?? null,
    conversationId: input.conversationId ?? null,
    hasImagePayload: hasBytes || hasUrl,
  };
}

/**
 * Provider adapter stub. Until owner approves a vision credential, never invents descriptions.
 */
export async function understandWhatsAppImage(input = {}, options = {}) {
  const validation = validateImageForVision(input);
  if (!validation.ok) {
    return {
      ok: false,
      provider: null,
      description: null,
      language: null,
      caption: null,
      code: validation.code,
      error: validation.error,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      mediaId: input.mediaId ?? null,
    };
  }

  const providerId = options.providerId || VISION_PROVIDER_REQUIREMENT.approvedProvider;
  if (!providerId) {
    return {
      ok: false,
      provider: null,
      description: null,
      language: validation.languageHint,
      caption: validation.caption,
      code: "VISION_PROVIDER_NOT_CONFIGURED",
      error: "No approved vision provider/credential. Caption/metadata fallback remains available.",
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
      requirement: VISION_PROVIDER_REQUIREMENT,
    };
  }

  const adapter = options.adapters?.[providerId];
  if (!adapter || typeof adapter.understand !== "function") {
    return {
      ok: false,
      provider: providerId,
      description: null,
      language: validation.languageHint,
      caption: validation.caption,
      code: "VISION_ADAPTER_MISSING",
      error: `No adapter registered for provider: ${providerId}`,
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
    };
  }

  if (!validation.hasImagePayload) {
    return {
      ok: false,
      provider: providerId,
      description: null,
      language: validation.languageHint,
      caption: validation.caption,
      code: "MISSING_MEDIA",
      error: "Vision adapter requires image bytes or URL.",
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
    };
  }

  let result;
  try {
    result = await adapter.understand({
      imageBytes: input.imageBytes,
      imageUrl: input.imageUrl,
      mimeType: validation.mimeType,
      caption: validation.caption,
      languageHint: validation.languageHint,
    });
  } catch (error) {
    return {
      ok: false,
      provider: providerId,
      description: null,
      language: validation.languageHint,
      caption: validation.caption,
      code: "VISION_FAILED",
      error: error instanceof Error ? error.message : "Vision provider error",
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
    };
  }

  const description = typeof result?.description === "string" ? result.description.trim() : "";
  if (!description) {
    return {
      ok: false,
      provider: providerId,
      description: null,
      language: validation.languageHint,
      caption: validation.caption,
      code: "VISION_EMPTY",
      error: "Provider returned empty image understanding.",
      conversationId: validation.conversationId,
      messageId: validation.messageId,
      mediaId: validation.mediaId,
    };
  }

  return {
    ok: true,
    provider: providerId,
    description,
    language: detectVisionLanguage(description) || validation.languageHint,
    caption: validation.caption,
    code: "VISION_OK",
    error: null,
    conversationId: validation.conversationId,
    messageId: validation.messageId,
    mediaId: validation.mediaId,
  };
}

/**
 * Maps vision result + caption into concierge turn input.
 * - Vision OK: prefer description (+ caption if present)
 * - Vision unavailable/failed: preserve caption if present; else image placeholder fallback
 */
export function applyVisionToConciergeInput(baseInput, vision) {
  const caption = typeof vision?.caption === "string" && vision.caption.trim()
    ? vision.caption.trim()
    : (typeof baseInput.caption === "string" ? baseInput.caption.trim() : "");

  if (vision?.ok && vision.description) {
    const messageBody = caption
      ? `${vision.description}\n\nCustomer caption: ${caption}`
      : vision.description;
    return {
      ...baseInput,
      safetyClassification: null,
      messageBody,
      caption: caption || null,
      visionStatus: "VISION_OK",
      visionDescription: vision.description,
    };
  }

  if (caption) {
    return {
      ...baseInput,
      safetyClassification: null,
      messageBody: caption,
      caption,
      visionStatus: vision?.code || "VISION_PROVIDER_NOT_CONFIGURED",
      visionDescription: null,
    };
  }

  return {
    ...baseInput,
    safetyClassification: baseInput.safetyClassification ?? "whatsapp_image",
    messageBody: baseInput.messageBody || "[Customer sent an image]",
    caption: null,
    visionStatus: vision?.code || "VISION_FAILED",
    visionDescription: null,
  };
}
