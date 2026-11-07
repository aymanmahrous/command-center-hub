import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20261107063000_whatsapp_do_not_contact_guard.sql", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/send-whatsapp-message/index.ts", import.meta.url), "utf8");
const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const inboxCss = await readFile(new URL("../src/ai-inbox.css", import.meta.url), "utf8");

test("WhatsApp send authorization blocks opted-out leads under a locked lead row", () => {
  assert.match(migration, /FROM public\.leads[\s\S]*?FOR UPDATE/);
  assert.match(migration, /coalesce\(v_lead\.do_not_contact, false\)/);
  assert.match(migration, /jsonb_build_object\('success', false, 'code', 'DO_NOT_CONTACT'\)/);
  assert.match(migration, /HUMAN_MODE_REQUIRED/);
  assert.match(migration, /LEAD_PHONE_MISSING/);
});

test("WhatsApp edge function stops before Meta send when the database guard rejects", () => {
  const guard = edge.indexOf("const allowed = await assertSendAllowed");
  const reject = edge.indexOf("if (!allowed.success) return json(allowed, 400)", guard);
  const send = edge.indexOf("sendViaWhatsAppCloud", guard);
  assert.ok(guard >= 0 && reject > guard && send > reject);
});

test("AI Inbox explains opt-out and invalid phone blocks in Arabic and English", () => {
  assert.match(app, /DO_NOT_CONTACT: "هذا العميل طلب عدم التواصل؛ تم منع إرسال الرسالة\."/);
  assert.match(app, /DO_NOT_CONTACT: "This customer opted out of contact; the reply was blocked\."/);
  assert.match(app, /LEAD_PHONE_MISSING/);
  assert.match(migration, /'doNotContact', coalesce\(l\.do_not_contact, false\)/);
  assert.match(app, /doNotContact: z\.boolean\(\)\.optional\(\)/);
  assert.match(app, /!selected\.doNotContact && selected\.channel === "whatsapp"/);
  assert.match(app, /disabled=\{Boolean\(selected\.doNotContact && mode === "ai_active"\)\}/);
  assert.match(app, /if \(conversation\.doNotContact && next === "ai_active"\)/);
  assert.match(app, /if \(conversation\.doNotContact\)/);
  assert.match(app, /do-not-contact-badge/);
  assert.match(inboxCss, /\.do-not-contact-badge/);
});
