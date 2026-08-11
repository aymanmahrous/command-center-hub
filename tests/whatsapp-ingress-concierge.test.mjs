import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = JSON.parse(await readFile(new URL("../n8n/workflows/relax-fix-whatsapp-webhook-ingress.json", import.meta.url), "utf8"));

test("whatsapp ingress preserves meta verification branches", () => {
  const webhook = workflow.nodes.find((node) => node.name === "Webhook");
  assert.equal(webhook?.parameters?.path, "whatsapp-meta-webhook");
  assert.equal(workflow.nodes.find((node) => node.name === "Subscribe Verification?")?.disabled, false);
  assert.ok(workflow.connections["Subscribe Verification?"]?.main?.[0]?.[0]?.node === "Verify Token Matches?");
  assert.ok(workflow.connections["Verify Token Matches?"]?.main?.[0]?.[0]?.node === "Return Verify Challenge");
  assert.ok(workflow.connections["Verify Token Matches?"]?.main?.[1]?.[0]?.node === "Reject Verification");
});

test("whatsapp ingress passes full Meta body via $json.body", () => {
  const ingest = workflow.nodes.find((node) => node.name === "Ingest WhatsApp Event");
  assert.match(ingest.parameters.jsonBody, /\$json\.body/);
  assert.doesNotMatch(ingest.parameters.jsonBody, /\$\('Webhook'\)\.first\(\)/);
  assert.equal(workflow.pinData && Object.keys(workflow.pinData).length, 0);
});

test("whatsapp ingress calls concierge only after MESSAGE_INGESTED", () => {
  const ingestedIf = workflow.nodes.find((node) => node.name === "Message Ingested?");
  assert.match(ingestedIf.parameters.conditions.conditions[0].leftValue, /MESSAGE_INGESTED/);
  assert.ok(workflow.connections["Ingest WhatsApp Event"]?.main?.[0]?.[0]?.node === "Message Ingested?");
  assert.ok(workflow.connections["Message Ingested?"]?.main?.[0]?.[0]?.node === "Draft Concierge Turn");
  assert.ok(workflow.connections["Message Ingested?"]?.main?.[1]?.[0]?.node === "Acknowledge Webhook");
});

test("whatsapp ingress sends draft reply only after DRAFT_READY", () => {
  const sendIf = workflow.nodes.find((node) => node.name === "Should Send WhatsApp Reply?");
  const prepare = workflow.nodes.find((node) => node.name === "Prepare WhatsApp Outbound");
  const readyIf = workflow.nodes.find((node) => node.name === "Outbound Payload Ready?");
  const send = workflow.nodes.find((node) => node.name === "Send WhatsApp Reply");
  assert.match(sendIf.parameters.conditions.conditions[0].leftValue, /DRAFT_READY/);
  assert.equal(prepare?.type, "n8n-nodes-base.code");
  assert.match(readyIf.parameters.conditions.conditions[0].leftValue, /outboundReady/);
  assert.match(send.parameters.url, /graph\.facebook\.com\/v21\.0\/1227466847119021\/messages/);
  assert.match(send.parameters.jsonBody, /outboundPayload/);
  assert.ok(workflow.connections["Draft Concierge Turn"]?.main?.[0]?.[0]?.node === "Should Send WhatsApp Reply?");
  assert.ok(workflow.connections["Should Send WhatsApp Reply?"]?.main?.[0]?.[0]?.node === "Prepare WhatsApp Outbound");
  assert.ok(workflow.connections["Prepare WhatsApp Outbound"]?.main?.[0]?.[0]?.node === "Outbound Payload Ready?");
  assert.ok(workflow.connections["Outbound Payload Ready?"]?.main?.[0]?.[0]?.node === "Send WhatsApp Reply");
  assert.ok(workflow.connections["Send WhatsApp Reply"]?.main?.[0]?.[0]?.node === "Acknowledge Webhook");
});

test("whatsapp ingress http nodes stay limited to ingest concierge and graph send", () => {
  const outboundUrls = workflow.nodes
    .filter((node) => node.type === "n8n-nodes-base.httpRequest")
    .map((node) => node.parameters.url)
    .sort();
  assert.deepEqual(
    outboundUrls,
    [
      "https://graph.facebook.com/v21.0/1227466847119021/messages",
      "https://nmzxrjdxvmmzzmajrskm.supabase.co/rest/v1/rpc/process_ai_sales_concierge_turn",
      "https://nmzxrjdxvmmzzmajrskm.supabase.co/rest/v1/rpc/process_whatsapp_webhook_ingress",
    ].sort(),
  );
});

test("whatsapp ingress still acknowledges with ingest payload", () => {
  const ack = workflow.nodes.find((node) => node.name === "Acknowledge Webhook");
  assert.match(ack.parameters.responseBody, /Ingest WhatsApp Event/);
});
