import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = JSON.parse(await readFile(new URL("../n8n/workflows/relax-fix-whatsapp-webhook-ingress.json", import.meta.url), "utf8"));
const phoneIdMigration = await readFile(
  new URL("../supabase/migrations/20260811205000_whatsapp_phone_number_id_update.sql", import.meta.url),
  "utf8",
);

test("whatsapp ingress phone number gate matches confirmed Meta Phone Number ID", () => {
  assert.match(phoneIdMigration, /1227466847119021/);
  assert.doesNotMatch(phoneIdMigration, /100566230597045/);
});

test("whatsapp ingress preserves meta verification branches", () => {
  assert.equal(workflow.nodes.find((node) => node.name === "WhatsApp Meta Webhook")?.parameters?.path, "whatsapp-meta-webhook");
  assert.ok(workflow.connections["Subscribe Verification?"]?.main?.[0]?.[0]?.node === "Verify Token Matches?");
  assert.ok(workflow.connections["Verify Token Matches?"]?.main?.[0]?.[0]?.node === "Return Verify Challenge");
  assert.ok(workflow.connections["Verify Token Matches?"]?.main?.[1]?.[0]?.node === "Reject Verification");
});

test("whatsapp ingress calls concierge only after MESSAGE_INGESTED", () => {
  const ingestedIf = workflow.nodes.find((node) => node.name === "Message Ingested?");
  assert.match(ingestedIf.parameters.conditions.conditions[0].leftValue, /MESSAGE_INGESTED/);
  assert.ok(workflow.connections["Ingest WhatsApp Event"]?.main?.[0]?.[0]?.node === "Message Ingested?");
  assert.ok(workflow.connections["Message Ingested?"]?.main?.[0]?.[0]?.node === "Draft Concierge Turn");
  assert.ok(workflow.connections["Message Ingested?"]?.main?.[1]?.[0]?.node === "Acknowledge Webhook");
});

test("whatsapp ingress concierge node stays draft-only", () => {
  const concierge = workflow.nodes.find((node) => node.name === "Draft Concierge Turn");
  assert.match(concierge.parameters.url, /process_ai_sales_concierge_turn/);
  assert.match(concierge.parameters.jsonBody, /p_conversation_id/);
  assert.match(concierge.parameters.jsonBody, /p_message_id/);
  const outboundUrls = workflow.nodes
    .filter((node) => node.type === "n8n-nodes-base.httpRequest")
    .map((node) => node.parameters.url);
  assert.deepEqual(
    outboundUrls,
    [
      "https://nmzxrjdxvmmzzmajrskm.supabase.co/rest/v1/rpc/process_whatsapp_webhook_ingress",
      "https://nmzxrjdxvmmzzmajrskm.supabase.co/rest/v1/rpc/process_ai_sales_concierge_turn",
    ],
  );
});

test("whatsapp ingress still acknowledges with ingest payload", () => {
  const ack = workflow.nodes.find((node) => node.name === "Acknowledge Webhook");
  assert.match(ack.parameters.responseBody, /Ingest WhatsApp Event/);
});
