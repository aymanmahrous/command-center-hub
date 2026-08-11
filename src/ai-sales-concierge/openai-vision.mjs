/**
 * OpenAI Vision adapter for Phase 6E.
 * Reads OPENAI_API_KEY from the secure environment only — never hard-coded.
 * Draft-only. No outbound messaging.
 */

export const OPENAI_VISION_PROVIDER_ID = "openai_vision";

export const OPENAI_VISION_SETUP = {
  providerId: OPENAI_VISION_PROVIDER_ID,
  model: "gpt-4o-mini",
  credentialEnv: "OPENAI_API_KEY",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  productionChanged: false,
  outboundEnabled: false,
};

const MIME_FALLBACK = "image/jpeg";

export function resolveOpenAiImageMime(mimeType) {
  const value = (mimeType || "").toLowerCase();
  if (value === "image/jpg") return "image/jpeg";
  if (value.startsWith("image/")) return value;
  return MIME_FALLBACK;
}

export function bytesToBase64(bytes) {
  if (!bytes) return null;
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const value of view) binary += String.fromCharCode(value);
  return btoa(binary);
}

export function buildOpenAiVisionMessages({ caption, languageHint, imageUrl, dataUrl }) {
  const language = (languageHint || "").startsWith("ar") ? "ar" : "en";
  const system = language === "ar"
    ? "أنت مساعد مبيعات لسباحة Relax Fix UAE. صف الصورة باختصار وبشكل عملي فقط لدعم التأهيل والحجز. لا تخترع أسعارًا أو مواعيدًا أو ضمانات. أجب بالعربية."
    : "You are a swimming sales assistant for Relax Fix UAE. Briefly and practically describe the image only to support lead qualification and booking. Do not invent prices, schedules, or guarantees. Reply in English.";

  const userText = caption
    ? (language === "ar"
      ? `تعليق العميل: ${caption}\nصف الصورة باختصار ثم اذكر ما الذي يحتاجه العميل من الحصص إن أمكن.`
      : `Customer caption: ${caption}\nBriefly describe the image and note any swimming-lesson intent if visible.`)
    : (language === "ar"
      ? "لا يوجد تعليق. صف الصورة باختصار بما يساعد على فهم نية العميل لحصص السباحة."
      : "No caption. Briefly describe the image to help understand swimming-lesson intent.");

  const imagePart = imageUrl
    ? { type: "image_url", image_url: { url: imageUrl } }
    : { type: "image_url", image_url: { url: dataUrl } };

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        imagePart,
      ],
    },
  ];
}

export function extractOpenAiVisionDescription(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}

/**
 * Creates an OpenAI Vision adapter compatible with understandWhatsAppImage adapters map.
 * apiKey/fetchImpl are injectable for synthetic tests; default apiKey reads env securely.
 */
export function createOpenAiVisionAdapter(options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? null;
  const model = options.model || OPENAI_VISION_SETUP.model;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const apiUrl = options.apiUrl || OPENAI_VISION_SETUP.apiUrl;

  return {
    id: OPENAI_VISION_PROVIDER_ID,
    hasCredential: Boolean(apiKey),
    async understand(input) {
      if (!apiKey) {
        const error = new Error("OPENAI_API_KEY is not configured in the secure environment");
        error.code = "VISION_CREDENTIAL_MISSING";
        throw error;
      }
      if (typeof fetchImpl !== "function") {
        const error = new Error("fetch is not available");
        error.code = "VISION_RUNTIME_UNSUPPORTED";
        throw error;
      }

      let imageUrl = input.imageUrl || null;
      let dataUrl = null;
      if (!imageUrl && input.imageBytes) {
        const mime = resolveOpenAiImageMime(input.mimeType);
        const encoded = bytesToBase64(input.imageBytes);
        dataUrl = `data:${mime};base64,${encoded}`;
      }
      if (!imageUrl && !dataUrl) {
        const error = new Error("MISSING_MEDIA");
        error.code = "MISSING_MEDIA";
        throw error;
      }

      const body = {
        model,
        temperature: 0.2,
        max_tokens: 300,
        messages: buildOpenAiVisionMessages({
          caption: input.caption,
          languageHint: input.languageHint,
          imageUrl,
          dataUrl,
        }),
      };

      const response = await fetchImpl(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = typeof response.text === "function" ? await response.text() : "";
        // Never include authorization material; truncate provider error body only.
        const error = new Error(`OpenAI Vision HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
        error.code = "VISION_FAILED";
        throw error;
      }

      const payload = await response.json();
      const description = extractOpenAiVisionDescription(payload);
      return { description, provider: OPENAI_VISION_PROVIDER_ID, model };
    },
  };
}

/** Returns true when OPENAI_API_KEY exists in the secure environment (value never returned). */
export function isOpenAiVisionCredentialPresent() {
  return Boolean(process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim());
}
