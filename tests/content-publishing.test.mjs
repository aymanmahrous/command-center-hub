import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZED_FACEBOOK_PUBLISH_ITEM_ID,
  buildExternalPostLink,
  buildTrackedCta,
  buildWhatsAppLeadUrl,
  hashtagsForPlatform,
  resolvePublishPipelineStage,
  summarizeLivePublishingReadiness,
} from "../src/content-publishing.ts";

test("video pipeline keeps facebook primary path without openai fallback", () => {
  const stage = resolvePublishPipelineStage({
    id: "11111111-1111-4111-8111-111111111111",
    status: "approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    platform: "facebook",
    contentType: "post",
    caption: "test",
    topic: "test",
    scheduledFor: null,
  });
  assert.equal(stage, "approved_ready");
});

test("published receipt resolves to published_live", () => {
  const stage = resolvePublishPipelineStage({
    id: "22222222-2222-4222-8222-222222222222",
    status: "approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    platform: "facebook",
    contentType: "post",
    caption: "test",
    topic: "test",
    scheduledFor: null,
    receipts: [{ platform: "facebook", status: "published", externalPostId: "1234567890", updatedAt: "2026-01-02T00:00:00.000Z" }],
  });
  assert.equal(stage, "published_live");
  assert.equal(buildExternalPostLink("facebook", "1234567890"), "https://www.facebook.com/1164107840123575/posts/1234567890");
});

test("readiness prioritizes authorized facebook publish item", () => {
  const readiness = summarizeLivePublishingReadiness([
    {
      id: AUTHORIZED_FACEBOOK_PUBLISH_ITEM_ID,
      status: "approved",
      createdAt: "2026-01-01T00:00:00.000Z",
      platform: "facebook",
      contentType: "post",
      caption: "authorized",
      topic: "authorized facebook test",
      scheduledFor: null,
    },
  ]);
  assert.equal(readiness.nextAction, "publish_via_n8n");
  assert.equal(readiness.authorizedItem?.topic, "authorized facebook test");
});

test("tracked cta includes whatsapp attribution without secrets", () => {
  const cta = buildTrackedCta("instagram", "swimming_education");
  assert.match(cta, /WhatsApp 058 821 9130/);
  assert.match(cta, /wa\.me\/971588219130/);
  assert.match(buildWhatsAppLeadUrl({ platform: "facebook", pillar: "conversion" }), /utm_source=facebook/);
  assert.match(buildWhatsAppLeadUrl({ platform: "facebook" }), /Relax\+Fix\+UAE/);
  assert.doesNotMatch(cta, /OPENAI|sk-/i);
});

test("hashtags follow Relax Fix UAE platform rules", () => {
  assert.deepEqual(hashtagsForPlatform("facebook"), ["#RelaxFixUAE"]);
  assert.deepEqual(hashtagsForPlatform("tiktok"), ["#RelaxFixUAE", "#AbuDhabiSwimming", "#SwimTok"]);
  assert.equal(hashtagsForPlatform("instagram", "reel")[0], "#RelaxFixUAE");
});
