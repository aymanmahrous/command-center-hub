import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(new URL("../src/integrations-center.tsx", import.meta.url), "utf8");

test("integration status requires explicit external verification evidence", () => {
  assert.match(source, /function externallyVerified\(item:/);
  assert.match(source, /verifiedExternally === true/);
  assert.match(source, /function capabilityState\(status: z\.infer<typeof Item>\["status"\]\): CapabilityState/);
  assert.doesNotMatch(source, /status === "connected" && lastTestedAt && verifiedExternally/);
  assert.match(source, /identity\/credential check does not prove that publishing or messaging works/);
  assert.match(source, /!isWhatsApp && item\.lastTestedAt && externallyVerified\(item\)/);
  assert.match(source, /External connection verified/);
  assert.match(source, /تم التحقق من الاتصال الخارجي/);
  assert.match(source, /a live external check passed/);
});

test("local configuration checks never imply that an external provider is working", () => {
  assert.match(source, /connected: "Local config test passed"/);
  assert.match(source, /configuration exists, but external operation is not verified/);
  assert.doesNotMatch(source, /const status = item\.lastTestedAt \?/);
});

// Render the actual card with a local fixture. The provider adapters are unused during rendering.
const require = createRequire(import.meta.url);
const view = { exports: {} };
const { outputText } = ts.transpileModule(source.replaceAll("import.meta.env", "({})"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  fileName: "integrations-center.tsx",
});
runInNewContext(outputText, {
  exports: view.exports,
  require(name) {
    if (name === "./i18n") return { useLanguage: () => ({ language: "ar" }) };
    if (name.startsWith("./")) return {};
    return require(name);
  },
});
const checkedAt = "2026-11-18T23:15:00Z";
function renderCard(overrides = {}) {
  const item = {
    id: "62000000-0000-4000-8000-000000000001", provider: "meta_whatsapp", connectionMethod: "oauth",
    displayName: "WhatsApp", status: "connected", metadata: { verifiedExternally: true }, lastTestedAt: checkedAt,
    updatedAt: checkedAt, ...overrides,
  };
  return renderToStaticMarkup(createElement(view.exports.default, { value: { success: true, items: [item] }, session: { role: "admin" } }));
}

test("WhatsApp shows number identity and Dubai check time together, with separate n8n intake", () => {
  const html = renderCard();
  assert.match(html, /تم التحقق من رقم واتساب/);
  assert.ok(html.includes(new Date(checkedAt).toLocaleString("ar-AE", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" })));
  assert.match(html, /وقت التحقق \(دبي\)/);
  assert.match(html, /استقبال الرسائل عبر n8n مستقل عن فحص الرقم/);
});

test("stale or incomplete WhatsApp verification cannot display a successful badge or a check time", () => {
  const cases = [
    [{ status: "error" }, "فشل"], [{ status: "disabled" }, "متوقف"], [{ status: "not_connected" }, "غير مربوط"],
    [{ status: "pending" }, "جاري الربط"], [{ status: "needs_test" }, "يحتاج اختبار"],
    [{ metadata: {} }, "يحتاج اختبار"], [{ metadata: { verifiedExternally: false } }, "يحتاج اختبار"],
    [{ lastTestedAt: null }, "يحتاج اختبار"], [{ lastTestedAt: "invalid" }, "يحتاج اختبار"],
  ];
  for (const [overrides, label] of cases) {
    const html = renderCard(overrides);
    assert.ok(html.includes(`>${label}</span>`), JSON.stringify(overrides));
    assert.doesNotMatch(html, /تم التحقق من رقم واتساب|تم التحقق من الاتصال الخارجي|<time\b/);
  }
});

test("only credential cards offer Edit, and the dialog makes no static Gemini readiness claim", () => {
  for (const status of ["connected", "needs_test", "error"]) {
    assert.doesNotMatch(renderCard({ provider: "instagram", status }), />تعديل<\/button>/);
    assert.match(renderCard({ provider: "ai_provider", connectionMethod: "api_key", status }), />تعديل<\/button>/);
  }
  assert.doesNotMatch(source, /centrally configured|مهيأ مركزياً/);
});

test("Instagram reconnect starts Facebook authorization while a connected card verifies its identity", async () => {
  const jsx = require("react/jsx-runtime");
  for (const status of ["disabled", "not_connected", "connected", "needs_test"]) {
    const reauthorize = status === "disabled" || status === "not_connected";
    const requests = [];
    const redirects = [];
    let press;
    const component = { exports: {} };
    runInNewContext(outputText, {
      exports: component.exports,
      require(name) {
        if (name === "./i18n") return { useLanguage: () => ({ language: "en" }) };
        if (name.startsWith("./")) return {};
        if (name !== "react/jsx-runtime") return require(name);
        return { ...jsx, jsx(type, props, key) {
          const label = status === "disabled" ? "Reconnect" : reauthorize ? "Verify & connect" : "Verify external connection";
          if (type === "button" && props.children === label) press = props.onClick;
          return jsx.jsx(type, props, key);
        } };
      },
      window: { location: { assign: (url) => redirects.push(url) } },
      fetch: async (url, options) => {
        requests.push([url, JSON.parse(options.body)]);
        return { ok: true, json: async () => ({ success: true, authorizationUrl: "https://example.invalid/auth" }) };
      },
    });
    const item = { id: "62000000-0000-4000-8000-000000000001", provider: "instagram", displayName: "Instagram", connectionMethod: "oauth", status, updatedAt: checkedAt };
    renderToStaticMarkup(createElement(component.exports.default, { value: { success: true, items: [item] }, session: { role: "admin" }, onChanged() {} }));
    assert.equal(typeof press, "function", status);
    press();
    await new Promise(setImmediate);
    assert.deepEqual(requests, [reauthorize ? ["/functions/v1/facebook-oauth", { mode: "authorize" }] : ["/functions/v1/meta-provider-status", { provider: "instagram" }]]);
    assert.deepEqual(redirects, reauthorize ? ["https://example.invalid/auth"] : []);
  }
});
