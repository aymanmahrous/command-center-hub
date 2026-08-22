import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSalesConciergeTurn } from "../src/ai-sales-concierge/logic.mjs";

const migration = await readFile(
  new URL("../supabase/migrations/20260811124417_meta_messaging_webhook_ingress_phase6f.sql", import.meta.url),
  "utf8",
);
const workflow = JSON.parse(
  await readFile(new URL("../n8n/workflows/relax-fix-meta-messaging-webhook-ingress.json", import.meta.url), "utf8"),
);

const SYNTHETIC_FACEBOOK_PAYLOAD = {
  object: "page",
  entry: [
    {
      id: "1164107840123575",
      time: 1710000000000,
      messaging: [
        {
          sender: { id: "9876543210" },
          recipient: { id: "1164107840123575" },
          timestamp: 1710000000000,
          message: {
            mid: "m_synthetic_facebook_001",
            text: "Hello, how much is a private lesson?",
          },
        },
      ],
    },
  ],
};

const SYNTHETIC_INSTAGRAM_PAYLOAD = {
  object: "instagram",
  entry: [
    {
      id: "17841439747493221",
      time: 1710000000000,
      messaging: [
        {
          sender: { id: "1122334455" },
          recipient: { id: "17841439747493221" },
          timestamp: 1710000000000,
          message: {
            mid: "m_synthetic_instagram_001",
            text: "مرحبا، كم سعر الحصة الخاصة؟",
          },
        },
      ],
    },
  ],
};

function extractSyntheticMessage(payload) {
  const entry = payload.entry?.[0];
  const messaging = entry?.messaging?.[0];
  return {
    object: payload.object,
    entryId: entry?.id ?? null,
    senderId: messaging?.sender?.id ?? null,
    recipientId: messaging?.recipient?.id ?? null,
    mid: messaging?.message?.mid ?? null,
    text: messaging?.message?.text ?? null,
  };
}

test("migration defines unified meta messaging ingress RPC", () => {
  assert.match(migration, /process_meta_messaging_webhook_ingress/);
  assert.match(migration, /1164107840123575/);
  assert.match(migration, /17841439747493221/);
  assert.match(migration, /'facebook'/);
  assert.match(migration, /'instagram'/);
  assert.match(migration, /MESSAGE_INGESTED/);
  assert.match(migration, /service_role/);
  assert.doesNotMatch(migration, /graph\.facebook\.com/i);
  assert.doesNotMatch(migration, /send.*message/i);
});

test("synthetic facebook payload matches expected ingress shape", () => {
  const parsed = extractSyntheticMessage(SYNTHETIC_FACEBOOK_PAYLOAD);
  assert.equal(parsed.object, "page");
  assert.equal(parsed.entryId, "1164107840123575");
  assert.equal(parsed.recipientId, "1164107840123575");
  assert.equal(parsed.senderId, "9876543210");
  assert.match(parsed.mid, /^m_/);
  assert.match(parsed.text, /private lesson/i);
});

test("synthetic instagram payload supports Arabic text", () => {
  const parsed = extractSyntheticMessage(SYNTHETIC_INSTAGRAM_PAYLOAD);
  assert.equal(parsed.object, "instagram");
  assert.equal(parsed.entryId, "17841439747493221");
  assert.match(parsed.text, /[ء-ي]/);
});

test("existing concierge logic handles facebook and instagram channels", () => {
  for (const channel of ["facebook", "instagram"]) {
    const en = buildSalesConciergeTurn({
      channel,
      mode: "ai_active",
      language: "en",
      messageBody: "How much does it cost?",
      intent: null,
      service: null,
      stage: "new",
      score: 0,
      fearOfWater: null,
      humanRequired: false,
      recentMessages: [],
    });
    assert.match(en.draftReply, /150 AED/);
    assert.equal(en.outboundEnabled, false);

    const ar = buildSalesConciergeTurn({
      channel,
      mode: "ai_active",
      language: "ar",
      messageBody: "كم السعر؟",
      intent: null,
      service: null,
      stage: "new",
      score: 0,
      fearOfWater: null,
      humanRequired: false,
      recentMessages: [],
    });
    assert.match(ar.draftReply, /150 درهم/);
    assert.equal(ar.outboundEnabled, false);
  }
});

test("meta messaging workflow stays inactive and separate from whatsapp", () => {
  assert.equal(workflow.active, false);
  assert.equal(
    workflow.nodes.find((node) => node.name === "Meta Messaging Webhook")?.parameters?.path,
    "meta-messaging-webhook",
  );
  assert.doesNotMatch(JSON.stringify(workflow), /whatsapp-meta-webhook/);
});

test("meta messaging workflow preserves verification branches", () => {
  assert.ok(workflow.connections["Subscribe Verification?"]?.main?.[0]?.[0]?.node === "Verify Token Matches?");
  assert.ok(workflow.connections["Verify Token Matches?"]?.main?.[0]?.[0]?.node === "Return Verify Challenge");
  assert.ok(workflow.connections["Verify Token Matches?"]?.main?.[1]?.[0]?.node === "Reject Verification");
});

test("meta messaging workflow calls concierge only after MESSAGE_INGESTED", () => {
  const ingestedIf = workflow.nodes.find((node) => node.name === "Message Ingested?");
  assert.match(ingestedIf.parameters.conditions.conditions[0].leftValue, /MESSAGE_INGESTED/);
  assert.ok(workflow.connections["Ingest Meta Messaging Event"]?.main?.[0]?.[0]?.node === "Message Ingested?");
  assert.ok(workflow.connections["Message Ingested?"]?.main?.[0]?.[0]?.node === "Draft Concierge Turn");
  assert.ok(workflow.connections["Message Ingested?"]?.main?.[1]?.[0]?.node === "Acknowledge Webhook");
});

test("meta messaging workflow has no outbound send URLs", () => {
  const outboundUrls = workflow.nodes
    .filter((node) => node.type === "n8n-nodes-base.httpRequest")
    .map((node) => node.parameters.url);
  assert.deepEqual(outboundUrls, [
    "https://nmzxrjdxvmmzzmajrskm.supabase.co/rest/v1/rpc/process_meta_messaging_webhook_ingress",
    "https://nmzxrjdxvmmzzmajrskm.supabase.co/rest/v1/rpc/process_ai_sales_concierge_turn",
  ]);
});
