import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesConciergeTurn } from "../src/ai-sales-concierge/logic.mjs";
import { buildImageConciergeTurn } from "../src/ai-sales-concierge/image.mjs";
import {
  VISION_PROVIDER_REQUIREMENT,
  applyVisionToConciergeInput,
  understandWhatsAppImage,
  validateImageForVision,
} from "../src/ai-sales-concierge/vision.mjs";

const arabicVisionAdapter = {
  async understand({ caption }) {
    return {
      description: caption
        ? `الصورة تظهر مسبحًا داخليًا. تعليق العميل: ${caption}`
        : "الصورة تظهر مسبحًا داخليًا مناسبًا للتدريب.",
    };
  },
};

const englishVisionAdapter = {
  async understand({ caption }) {
    return {
      description: caption
        ? `The image shows an indoor pool. Customer caption: ${caption}`
        : "The image shows an indoor swimming pool suitable for lessons.",
    };
  },
};

const failingVisionAdapter = {
  async understand() {
    throw new Error("vision unavailable");
  },
};

test("no unpaid vision provider is silently activated without env credential", () => {
  assert.equal(VISION_PROVIDER_REQUIREMENT.approvedProvider, "openai_vision");
  assert.equal(VISION_PROVIDER_REQUIREMENT.preferredProvider, "openai_vision");
  assert.equal(VISION_PROVIDER_REQUIREMENT.status, "OWNER_APPROVED_OPENAI_VISION");
  assert.equal(VISION_PROVIDER_REQUIREMENT.outboundEnabled, false);
  assert.equal(VISION_PROVIDER_REQUIREMENT.productionChanged, false);
});

test("image with caption preserves caption in concierge pricing flow", async () => {
  const result = await buildImageConciergeTurn({
    caption: "How much is a private lesson?",
    stage: "new",
  });
  assert.ok(["VISION_PROVIDER_NOT_CONFIGURED", "MISSING_MEDIA"].includes(result.vision.code));
  assert.match(result.draftReply, /150 AED instead of 200 AED/);
  assert.equal(result.outboundEnabled, false);
});

test("image without caption keeps Phase 6C contextual follow-up", async () => {
  const result = await buildImageConciergeTurn({
    imageBytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/jpeg",
    stage: "new",
  });
  assert.equal(result.detectedIntent, "awaiting_image_context");
  assert.match(result.draftReply, /private lessons|حصص خاصة/i);
});

test("unsupported or missing media returns typed failure", async () => {
  const missing = await understandWhatsAppImage({});
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "MISSING_MEDIA");

  const unsupported = validateImageForVision({
    imageBytes: new Uint8Array([1]),
    mimeType: "application/pdf",
  });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.code, "UNSUPPORTED_IMAGE");
});

test("Arabic question about image with vision adapter feeds concierge", async () => {
  const result = await buildImageConciergeTurn(
    {
      imageBytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      caption: "كم السعر؟",
      languageHint: "ar",
      stage: "new",
    },
    { providerId: "openai_vision", adapters: { openai_vision: arabicVisionAdapter } },
  );
  assert.equal(result.vision.ok, true);
  assert.match(result.draftReply, /150 درهم بدل 200 درهم/);
  assert.equal(result.outboundEnabled, false);
});

test("English question about image with vision adapter feeds concierge", async () => {
  const mapped = applyVisionToConciergeInput(
    {
      mode: "ai_active",
      messageBody: "[Customer sent an image]",
      safetyClassification: "whatsapp_image",
      stage: "new",
      score: 0,
    },
    {
      ok: true,
      description: "Child standing near a swimming pool.",
      caption: "Do you offer private lessons?",
      code: "VISION_OK",
    },
  );
  const turn = buildSalesConciergeTurn(mapped);
  assert.equal(mapped.visionStatus, "VISION_OK");
  assert.match(mapped.messageBody, /Child standing near a swimming pool/);
  assert.match(mapped.messageBody, /Customer caption/);
  assert.equal(turn.nextService, "private");
});

test("vision failure falls back to caption without fabricating understanding", async () => {
  const result = await buildImageConciergeTurn(
    {
      imageBytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      caption: "I want group lessons",
      stage: "new",
    },
    { providerId: "openai_vision", adapters: { openai_vision: failingVisionAdapter } },
  );
  assert.equal(result.vision.ok, false);
  assert.equal(result.vision.description, null);
  assert.equal(result.nextService, "group");
});

test("existing text-only flow remains unchanged", () => {
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
