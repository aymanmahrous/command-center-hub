import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesConciergeTurn } from "../src/ai-sales-concierge/logic.mjs";
import {
  STT_PROVIDER_REQUIREMENT,
  applyTranscriptionToConciergeInput,
  transcribeWhatsAppAudio,
  validateAudioForStt,
} from "../src/ai-sales-concierge/stt.mjs";
import { buildVoiceConciergeTurn } from "../src/ai-sales-concierge/voice.mjs";

const arabicAdapter = {
  async transcribe() {
    return { text: "كم سعر الحصة الخاصة؟" };
  },
};

const englishAdapter = {
  async transcribe() {
    return { text: "How much is a private lesson?" };
  },
};

const failingAdapter = {
  async transcribe() {
    throw new Error("provider timeout");
  },
};

const emptyAdapter = {
  async transcribe() {
    return { text: "   " };
  },
};

test("owner approval is required before any STT provider is selected", () => {
  assert.equal(STT_PROVIDER_REQUIREMENT.approvedProvider, null);
  assert.equal(STT_PROVIDER_REQUIREMENT.status, "OWNER_SETUP_REQUIRED");
  assert.equal(STT_PROVIDER_REQUIREMENT.preferredProvider, "google_speech_to_text_v2");
  assert.equal(STT_PROVIDER_REQUIREMENT.outboundEnabled, false);
  assert.equal(STT_PROVIDER_REQUIREMENT.productionChanged, false);
});

test("Arabic transcription success feeds concierge with approved pricing", async () => {
  const result = await buildVoiceConciergeTurn(
    {
      audioBytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/ogg",
      languageHint: "ar",
      conversationId: "11111111-1111-1111-1111-111111111111",
      messageId: "22222222-2222-2222-2222-222222222222",
      stage: "new",
    },
    { providerId: "openai_whisper", adapters: { openai_whisper: arabicAdapter } },
  );

  assert.equal(result.transcription.ok, true);
  assert.equal(result.transcription.code, "TRANSCRIPTION_OK");
  assert.equal(result.transcription.language, "ar");
  assert.match(result.draftReply, /150 درهم بدل 200 درهم/);
  assert.equal(result.outboundEnabled, false);
  assert.equal(result.conversationId, "11111111-1111-1111-1111-111111111111");
  assert.equal(result.messageId, "22222222-2222-2222-2222-222222222222");
});

test("English transcription success feeds concierge with approved pricing", async () => {
  const result = await buildVoiceConciergeTurn(
    {
      audioBytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/ogg",
      languageHint: "en",
      stage: "new",
    },
    { providerId: "openai_whisper", adapters: { openai_whisper: englishAdapter } },
  );

  assert.equal(result.transcription.ok, true);
  assert.equal(result.transcription.language, "en");
  assert.match(result.draftReply, /150 AED instead of 200 AED/);
  assert.equal(result.outboundEnabled, false);
});

test("transcription failure never fabricates text", async () => {
  const result = await buildVoiceConciergeTurn(
    {
      audioBytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/ogg",
      stage: "new",
    },
    { providerId: "openai_whisper", adapters: { openai_whisper: failingAdapter } },
  );

  assert.equal(result.transcription.ok, false);
  assert.equal(result.transcription.code, "TRANSCRIPTION_FAILED");
  assert.equal(result.transcription.text, null);
  assert.match(result.draftReply, /voice note|رسالتك الصوتية/i);
  assert.doesNotMatch(result.draftReply, /150 AED|150 درهم/);
});

test("empty and unsupported audio are typed failures", async () => {
  const empty = await transcribeWhatsAppAudio({});
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "EMPTY_AUDIO");
  assert.equal(empty.text, null);

  const unsupported = validateAudioForStt({ audioBytes: new Uint8Array([1]), mimeType: "video/mp4" });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.code, "UNSUPPORTED_AUDIO");

  const emptyText = await transcribeWhatsAppAudio(
    { audioBytes: new Uint8Array([1]), mimeType: "audio/ogg" },
    { providerId: "openai_whisper", adapters: { openai_whisper: emptyAdapter } },
  );
  assert.equal(emptyText.ok, false);
  assert.equal(emptyText.code, "TRANSCRIPTION_EMPTY");
});

test("concierge receives resulting transcription text through apply helper", () => {
  const mapped = applyTranscriptionToConciergeInput(
    {
      mode: "ai_active",
      messageBody: "[Customer sent a voice note]",
      safetyClassification: "whatsapp_audio",
      stage: "new",
      score: 0,
    },
    {
      ok: true,
      text: "I want a private lesson",
      language: "en",
      code: "TRANSCRIPTION_OK",
    },
  );

  const turn = buildSalesConciergeTurn(mapped);
  assert.equal(mapped.transcriptionStatus, "TRANSCRIPTION_OK");
  assert.equal(turn.detectedIntent, "awaiting_fear_of_water");
  assert.equal(turn.nextService, "private");
});

test("existing text-only behavior remains unchanged", () => {
  const turn = buildSalesConciergeTurn({
    mode: "ai_active",
    messageBody: "How much does it cost?",
    safetyClassification: null,
    stage: "new",
    score: 0,
  });
  assert.match(turn.draftReply, /150 AED instead of 200 AED/);
  assert.equal(turn.outboundEnabled, false);
});

test("unconfigured provider stops closed without inventing text", async () => {
  const result = await transcribeWhatsAppAudio({
    audioBytes: new Uint8Array([9]),
    mimeType: "audio/ogg",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "STT_PROVIDER_NOT_CONFIGURED");
  assert.equal(result.text, null);
});
