import assert from "node:assert/strict";
import test from "node:test";
import {
  GOOGLE_STT_V2_PROVIDER_ID,
  GOOGLE_STT_V2_SETUP,
  buildGoogleRecognizeRequest,
  createGoogleSpeechV2Adapter,
  extractTranscriptFromRecognizeResponse,
  resolveGoogleLanguageCodes,
} from "../src/ai-sales-concierge/google-stt-v2.mjs";
import { STT_PROVIDER_REQUIREMENT, transcribeWhatsAppAudio } from "../src/ai-sales-concierge/stt.mjs";
import { buildVoiceConciergeTurn } from "../src/ai-sales-concierge/voice.mjs";

test("Google STT V2 is the preferred provider and remains inactive without credentials", () => {
  assert.equal(STT_PROVIDER_REQUIREMENT.preferredProvider, GOOGLE_STT_V2_PROVIDER_ID);
  assert.equal(STT_PROVIDER_REQUIREMENT.approvedProvider, null);
  assert.equal(GOOGLE_STT_V2_SETUP.preferredModel, "chirp_3");
  assert.deepEqual(GOOGLE_STT_V2_SETUP.languageCodes, ["ar-AE", "ar-EG", "en-US"]);
  assert.equal(GOOGLE_STT_V2_SETUP.outboundEnabled, false);
  assert.equal(GOOGLE_STT_V2_SETUP.productionChanged, false);
});

test("language resolution prefers ar-AE / ar-EG / en", () => {
  assert.deepEqual(resolveGoogleLanguageCodes("ar"), ["ar-AE", "ar-EG", "en-US"]);
  assert.deepEqual(resolveGoogleLanguageCodes("ar-EG"), ["ar-EG", "ar-AE", "en-US"]);
  assert.deepEqual(resolveGoogleLanguageCodes("en"), ["en-US", "ar-AE", "ar-EG"]);
});

test("recognize request uses chirp_3 and never invents transcript text", () => {
  const request = buildGoogleRecognizeRequest({
    audioBytes: new Uint8Array([1, 2, 3, 4]),
    mimeType: "audio/ogg",
    languageHint: "ar",
  });
  assert.equal(request.config.model, "chirp_3");
  assert.ok(request.config.languageCodes.includes("ar-AE"));
  assert.ok(request.content);
  assert.equal(extractTranscriptFromRecognizeResponse({ results: [] }), "");
});

test("Google adapter Arabic success feeds existing concierge", async () => {
  const adapter = createGoogleSpeechV2Adapter({
    projectId: "demo-project",
    accessTokenProvider: async () => "test-token",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          results: [{ alternatives: [{ transcript: "كم سعر الحصة الخاصة؟" }] }],
        };
      },
    }),
  });

  const result = await buildVoiceConciergeTurn(
    {
      audioBytes: new Uint8Array([9, 9, 9]),
      mimeType: "audio/ogg",
      languageHint: "ar",
      stage: "new",
    },
    { providerId: GOOGLE_STT_V2_PROVIDER_ID, adapters: { [GOOGLE_STT_V2_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.transcription.ok, true);
  assert.equal(result.transcription.provider, GOOGLE_STT_V2_PROVIDER_ID);
  assert.match(result.draftReply, /150 درهم بدل 200 درهم/);
  assert.equal(result.outboundEnabled, false);
});

test("Google adapter English success feeds existing concierge", async () => {
  const adapter = createGoogleSpeechV2Adapter({
    projectId: "demo-project",
    accessTokenProvider: async () => "test-token",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          results: [{ alternatives: [{ transcript: "How much is a private lesson?" }] }],
        };
      },
    }),
  });

  const result = await transcribeWhatsAppAudio(
    { audioBytes: new Uint8Array([1]), mimeType: "audio/ogg", languageHint: "en" },
    { providerId: GOOGLE_STT_V2_PROVIDER_ID, adapters: { [GOOGLE_STT_V2_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.ok, true);
  assert.equal(result.language, "en");
  assert.match(result.text, /private lesson/i);
});

test("Google adapter failure falls back without fabricating text", async () => {
  const adapter = createGoogleSpeechV2Adapter({
    projectId: "demo-project",
    accessTokenProvider: async () => "test-token",
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async text() {
        return "unavailable";
      },
    }),
  });

  const result = await buildVoiceConciergeTurn(
    {
      audioBytes: new Uint8Array([1]),
      mimeType: "audio/ogg",
      stage: "new",
    },
    { providerId: GOOGLE_STT_V2_PROVIDER_ID, adapters: { [GOOGLE_STT_V2_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.transcription.ok, false);
  assert.equal(result.transcription.text, null);
  assert.match(result.draftReply, /voice note|رسالتك الصوتية/i);
});

test("missing Google credentials keep provider inactive", async () => {
  const adapter = createGoogleSpeechV2Adapter({
    projectId: null,
    accessTokenProvider: async () => null,
  });

  const result = await transcribeWhatsAppAudio(
    { audioBytes: new Uint8Array([1]), mimeType: "audio/ogg" },
    { providerId: GOOGLE_STT_V2_PROVIDER_ID, adapters: { [GOOGLE_STT_V2_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "TRANSCRIPTION_FAILED");
  assert.equal(result.text, null);
});
