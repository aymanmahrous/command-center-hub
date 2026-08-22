import assert from "node:assert/strict";
import test from "node:test";
import { buildImageConciergeTurn } from "../src/ai-sales-concierge/image.mjs";
import {
  OPENAI_VISION_PROVIDER_ID,
  OPENAI_VISION_SETUP,
  createOpenAiVisionAdapter,
  extractOpenAiVisionDescription,
  isOpenAiVisionCredentialPresent,
} from "../src/ai-sales-concierge/openai-vision.mjs";
import { VISION_PROVIDER_REQUIREMENT } from "../src/ai-sales-concierge/vision.mjs";

test("OpenAI Vision is approved and reads credential env name only", () => {
  assert.equal(VISION_PROVIDER_REQUIREMENT.approvedProvider, OPENAI_VISION_PROVIDER_ID);
  assert.equal(VISION_PROVIDER_REQUIREMENT.preferredProvider, OPENAI_VISION_PROVIDER_ID);
  assert.equal(OPENAI_VISION_SETUP.credentialEnv, "OPENAI_API_KEY");
  assert.equal(OPENAI_VISION_SETUP.outboundEnabled, false);
  assert.equal(OPENAI_VISION_SETUP.productionChanged, false);
  assert.equal(typeof isOpenAiVisionCredentialPresent(), "boolean");
});

test("image + caption via OpenAI Vision adapter feeds concierge", async () => {
  const adapter = createOpenAiVisionAdapter({
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { choices: [{ message: { content: "Indoor pool lane. Customer asks about private lessons." } }] };
      },
    }),
  });

  const result = await buildImageConciergeTurn(
    {
      imageBytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
      caption: "Do you offer private lessons?",
      stage: "new",
    },
    { providerId: OPENAI_VISION_PROVIDER_ID, adapters: { [OPENAI_VISION_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.vision.ok, true);
  assert.equal(result.vision.provider, OPENAI_VISION_PROVIDER_ID);
  assert.equal(result.nextService, "private");
  assert.equal(result.outboundEnabled, false);
});

test("image without caption via OpenAI Vision still returns draft-only follow-up path", async () => {
  const adapter = createOpenAiVisionAdapter({
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { choices: [{ message: { content: "A child near a swimming pool with floaties." } }] };
      },
    }),
  });

  const result = await buildImageConciergeTurn(
    {
      imageBytes: new Uint8Array([4, 5, 6]),
      mimeType: "image/png",
      stage: "new",
    },
    { providerId: OPENAI_VISION_PROVIDER_ID, adapters: { [OPENAI_VISION_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.vision.ok, true);
  assert.match(result.draftReply, /private lesson|group lesson|حصة/i);
  assert.equal(result.outboundEnabled, false);
});

test("unsupported or missing image stays typed failure / fallback", async () => {
  const missing = await buildImageConciergeTurn({ stage: "new" });
  assert.equal(missing.vision.ok, false);
  assert.ok(["MISSING_MEDIA", "VISION_PROVIDER_NOT_CONFIGURED"].includes(missing.vision.code));
});

test("vision failure falls back without fabricating description", async () => {
  const adapter = createOpenAiVisionAdapter({
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      async text() {
        return "server error";
      },
    }),
  });

  const result = await buildImageConciergeTurn(
    {
      imageBytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      caption: "How much is a private lesson?",
      stage: "new",
    },
    { providerId: OPENAI_VISION_PROVIDER_ID, adapters: { [OPENAI_VISION_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.vision.ok, false);
  assert.equal(result.vision.description, null);
  assert.match(result.draftReply, /150 AED instead of 200 AED/);
});

test("Arabic question about image uses Arabic pricing draft", async () => {
  const adapter = createOpenAiVisionAdapter({
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.match(JSON.stringify(body.messages), /تعليق العميل|العربية/);
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: "المسبح ظاهر في الصورة والسؤال عن السعر." } }] };
        },
      };
    },
  });

  const result = await buildImageConciergeTurn(
    {
      imageBytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      caption: "كم سعر الحصة الخاصة؟",
      languageHint: "ar",
      stage: "new",
    },
    { providerId: OPENAI_VISION_PROVIDER_ID, adapters: { [OPENAI_VISION_PROVIDER_ID]: adapter } },
  );

  assert.equal(result.vision.ok, true);
  assert.match(result.draftReply, /150 درهم بدل 200 درهم/);
});

test("English question about image uses English pricing draft", async () => {
  assert.equal(extractOpenAiVisionDescription({ choices: [{ message: { content: "Pool photo" } }] }), "Pool photo");
  const adapter = createOpenAiVisionAdapter({
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { choices: [{ message: { content: "Swimming pool photo." } }] };
      },
    }),
  });

  const result = await buildImageConciergeTurn(
    {
      imageBytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      caption: "How much is a private lesson?",
      languageHint: "en",
      stage: "new",
    },
    { providerId: OPENAI_VISION_PROVIDER_ID, adapters: { [OPENAI_VISION_PROVIDER_ID]: adapter } },
  );

  assert.match(result.draftReply, /150 AED instead of 200 AED/);
  assert.equal(result.outboundEnabled, false);
});
