/**
 * Google Cloud Speech-to-Text V2 adapter (Chirp 3 preferred for short WhatsApp notes).
 *
 * Repo-only. Does not load Production secrets.
 * Credentials must be injected by the runtime after owner setup — never hard-coded.
 *
 * Target languages: ar-AE, ar-EG, en
 * Preferred model: chirp_3
 */

export const GOOGLE_STT_V2_PROVIDER_ID = "google_speech_to_text_v2";

export const GOOGLE_STT_V2_SETUP = {
  providerId: GOOGLE_STT_V2_PROVIDER_ID,
  api: "Speech-to-Text V2",
  preferredModel: "chirp_3",
  languageCodes: ["ar-AE", "ar-EG", "en-US"],
  credentialEnv: "GOOGLE_SPEECH_CREDENTIALS_JSON",
  projectIdEnv: "GOOGLE_CLOUD_PROJECT_ID",
  recognizerEnv: "GOOGLE_SPEECH_RECOGNIZER",
  regionEnv: "GOOGLE_SPEECH_LOCATION",
  defaultLocation: "global",
  billing: "Owner must enable Speech-to-Text API + billing on the Google Cloud project (not done by this agent).",
  productionChanged: false,
  outboundEnabled: false,
};

const MIME_TO_ENCODING = {
  "audio/ogg": "OGG_OPUS",
  "audio/opus": "OGG_OPUS",
  "audio/wav": "LINEAR16",
  "audio/x-wav": "LINEAR16",
  "audio/mpeg": "MP3",
  "audio/mp4": "MP3",
  "audio/aac": "MP3",
  "audio/webm": "WEBM_OPUS",
};

export function resolveGoogleLanguageCodes(languageHint) {
  const hint = (languageHint || "").toLowerCase();
  if (hint.startsWith("en")) return ["en-US", "ar-AE", "ar-EG"];
  if (hint === "ar-eg" || hint.includes("egypt")) return ["ar-EG", "ar-AE", "en-US"];
  if (hint === "ar-ae" || hint.includes("gulf") || hint.includes("uae")) return ["ar-AE", "ar-EG", "en-US"];
  if (hint.startsWith("ar")) return ["ar-AE", "ar-EG", "en-US"];
  return ["ar-AE", "ar-EG", "en-US"];
}

export function resolveGoogleEncoding(mimeType) {
  if (!mimeType) return "OGG_OPUS";
  return MIME_TO_ENCODING[mimeType.toLowerCase()] || "OGG_OPUS";
}

export function bytesToBase64(bytes) {
  if (!bytes) return null;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const value of view) binary += String.fromCharCode(value);
  return btoa(binary);
}

export function extractTranscriptFromRecognizeResponse(payload) {
  const results = payload?.results;
  if (!Array.isArray(results) || results.length === 0) return "";
  const parts = [];
  for (const result of results) {
    const alt = result?.alternatives?.[0];
    const transcript = typeof alt?.transcript === "string" ? alt.transcript.trim() : "";
    if (transcript) parts.push(transcript);
  }
  return parts.join(" ").trim();
}

export function buildGoogleRecognizeRequest({ audioBytes, audioUrl, mimeType, languageHint, model = GOOGLE_STT_V2_SETUP.preferredModel }) {
  const languageCodes = resolveGoogleLanguageCodes(languageHint);
  const config = {
    autoDecodingConfig: {},
    languageCodes,
    model,
  };

  // Prefer auto-decoding for WhatsApp OGG/Opus; keep explicit encoding hint when known.
  const encoding = resolveGoogleEncoding(mimeType);
  if (encoding && mimeType) {
    config.explicitDecodingConfig = {
      encoding,
    };
  }

  const request = { config };
  if (audioBytes && (audioBytes.byteLength > 0 || audioBytes.length > 0)) {
    request.content = bytesToBase64(audioBytes);
  } else if (audioUrl) {
    request.uri = String(audioUrl);
  } else {
    throw new Error("EMPTY_AUDIO");
  }
  return request;
}

/**
 * Creates a Google STT V2 adapter compatible with transcribeWhatsAppAudio adapters map.
 * accessTokenProvider / fetchImpl are injectable for synthetic tests.
 */
export function createGoogleSpeechV2Adapter(options = {}) {
  const projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID || null;
  const location = options.location || process.env.GOOGLE_SPEECH_LOCATION || GOOGLE_STT_V2_SETUP.defaultLocation;
  const recognizer = options.recognizer || process.env.GOOGLE_SPEECH_RECOGNIZER || "_";
  const model = options.model || GOOGLE_STT_V2_SETUP.preferredModel;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const accessTokenProvider = options.accessTokenProvider;

  return {
    id: GOOGLE_STT_V2_PROVIDER_ID,
    async transcribe(input) {
      if (!projectId) {
        const error = new Error("GOOGLE_CLOUD_PROJECT_ID is not configured");
        error.code = "STT_CREDENTIAL_MISSING";
        throw error;
      }
      if (typeof accessTokenProvider !== "function") {
        const error = new Error("Google access token provider is not configured");
        error.code = "STT_CREDENTIAL_MISSING";
        throw error;
      }
      if (typeof fetchImpl !== "function") {
        const error = new Error("fetch is not available");
        error.code = "STT_RUNTIME_UNSUPPORTED";
        throw error;
      }

      const token = await accessTokenProvider();
      if (!token) {
        const error = new Error("Google access token unavailable");
        error.code = "STT_CREDENTIAL_MISSING";
        throw error;
      }

      const body = buildGoogleRecognizeRequest({
        audioBytes: input.audioBytes,
        audioUrl: input.audioUrl,
        mimeType: input.mimeType,
        languageHint: input.languageHint,
        model,
      });

      const url = `https://speech.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/recognizers/${encodeURIComponent(recognizer)}:recognize`;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = typeof response.text === "function" ? await response.text() : "";
        const error = new Error(`Google STT V2 HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
        error.code = "TRANSCRIPTION_FAILED";
        throw error;
      }

      const payload = await response.json();
      const text = extractTranscriptFromRecognizeResponse(payload);
      return { text, provider: GOOGLE_STT_V2_PROVIDER_ID, model, languageCodes: resolveGoogleLanguageCodes(input.languageHint) };
    },
  };
}
