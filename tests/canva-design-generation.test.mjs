import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildStrictAutofillData, prepareCanvaCopy } from "../supabase/functions/canva-design/copy.ts";

const adapter = await readFile(new URL("../src/canva-design-adapter.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/canva-design/index.ts", import.meta.url), "utf8");
const copySource = await readFile(new URL("../supabase/functions/canva-design/copy.ts", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");
const growthHub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");

test("canva design adapter stays server-side", () => {
  assert.match(adapter, /functions\/v1\/canva-design/);
  assert.match(adapter, /generateCanvaDesignForContentItem/);
  assert.doesNotMatch(adapter, /CANVA_CLIENT_SECRET|VITE_CANVA/i);
});

test("canva design edge function uses brand template or source design autofill and export", () => {
  assert.match(edge, /CANVA_BRAND_TEMPLATE_ID/);
  assert.match(edge, /CANVA_SOURCE_DESIGN_ID/);
  assert.match(edge, /discoverAccessibleSourceDesignIds/);
  assert.match(edge, /\/designs\?query=\$\{encodeURIComponent\(query\)\}&limit=50/);
  assert.match(edge, /create_from_design/);
  assert.match(edge, /\/autofills/);
  assert.match(edge, /\/exports/);
  assert.match(edge, /media_asset_id/);
});

test("batch review panel exposes generate Canva design action", () => {
  assert.match(panel, /generateCanvaDesignForContentItem/);
  assert.match(panel, /generateDesignButton/);
});

test("Canva is selected automatically only when fully ready and can rotate across configured templates", () => {
  assert.match(panel, /designCapabilityState === "AVAILABLE"/);
  assert.match(panel, /resolveDesignProvider\("auto"/);
  assert.match(edge, /CANVA_BRAND_TEMPLATE_IDS/);
  assert.match(edge, /Deno\.env\.get\("CANVA_BRAND_TEMPLATE_ID"\) \?\? ""/);
  assert.match(edge, /chooseBrandTemplateId\(contentItemId\)/);
  assert.match(edge, /brandTemplateCount: CANVA_BRAND_TEMPLATE_IDS.length/);
});

test("Canva can replace a template image with the content item's linked library image", () => {
  assert.match(adapter, /sourceMediaAssetId: typeof item\.mediaAssetId === "string" \? item\.mediaAssetId : ""/);
  assert.match(edge, /\/brand-templates\/\$\{selectedBrandTemplateId\}\/dataset/);
  assert.match(edge, /const imageFields = datasetFields\(datasetResult\.dataset, "image"\)/);
  assert.match(edge, /uploadLinkedImageToCanva\(accessToken, supabase, contentItemId, sourceMediaAssetId\)/);
  assert.match(copySource, /type: "image", asset_id: imageAssetId/);
  assert.match(edge, /MEDIA_ASSET_NOT_LINKED/);
  assert.match(edge, /CANVA_IMAGE_UPLOAD_FAILED/);
});

test("Canva status diagnoses missing permissions and image fields without generating", () => {
  const statusStart = edge.indexOf('if (body.mode === "status")');
  const generateStart = edge.indexOf('if (body.mode !== "generate")', statusStart);
  const statusBranch = edge.slice(statusStart, generateStart);
  assert.match(edge, /CANVA_REQUIRED_SCOPES = \["design:content:read", "design:content:write", "asset:write", "asset:read"\]/);
  assert.match(edge, /code: "CANVA_MISSING_SCOPES", missingScopes/);
  assert.match(statusBranch, /missingScopes/);
  assert.match(statusBranch, /templateImageAutofillReady/);
  assert.match(statusBranch, /templateImageFieldCount/);
  assert.match(statusBranch, /nextAction/);
  assert.doesNotMatch(statusBranch, /createAutofillDesign|exportDesignPng|storeDesignForContentItem/);
});

test("Factory checks Canva creative readiness before offering Canva as available", () => {
  assert.match(growthHub, /fetchCanvaDesignStatus/);
  assert.match(growthHub, /assessCanvaReadiness\(canvaIntegration\?\.status, canvaDesignStatus\)/);
  assert.match(growthHub, /formatCanvaDiagnosticDetails\(canvaDesignStatus\)/);
  assert.match(growthHub, /canvaStatusNotice/);
  assert.match(adapter, /templateImageFieldCount/);
  assert.match(adapter, /credentialsConfigured/);
  assert.match(adapter, /missingScopes/);
});

test("Canva refuses to silently create a same-looking design from a template without an image field", () => {
  assert.match(edge, /if \(imageFields.length === 0\) return \{ error: "TEMPLATE_IMAGE_FIELD_MISSING" as const \}/);
  assert.match(adapter, /case "TEMPLATE_IMAGE_FIELD_MISSING"/);
});

test("Canva reports when the template kept its default image instead of replacing it", () => {
  assert.match(edge, /imageApplied: autofill\.imageApplied === true/);
  assert.match(adapter, /imageApplied: result\.imageApplied === true/);
  assert.match(panel, /main image was not replaced automatically/);
});

test("Canva status path does not generate or export, but refreshes and stores OAuth credentials", () => {
  const statusStart = edge.indexOf('if (body.mode === "status")');
  const generateStart = edge.indexOf('if (body.mode !== "generate")', statusStart);
  assert.ok(statusStart >= 0 && generateStart > statusStart, "status branch must remain before generation");
  const statusBranch = edge.slice(statusStart, generateStart);
  assert.match(edge, /staffId = staff\.staffId/);
  assert.doesNotMatch(edge, /staffId = staffId/);
  assert.match(statusBranch, /refreshCanvaAccessToken/);
  assert.doesNotMatch(statusBranch, /createAutofillDesign|exportDesignPng|storeDesignForContentItem/);
  assert.match(edge, /from\("staff_canva_tokens"\)\.upsert/);
});

test("Canva copy removes production instructions and keeps the publishing caption untouched", () => {
  const original = "Q: هل طفلك يخاف من الماء؟\nA: ابدأ بخطوات هادئة وبسيطة.\n0–2s: title card\n3–8s: child a9–10s\nWhatsApp 058 821 9130";
  const copy = prepareCanvaCopy({ hook: "هل طفلك يخاف من الماء؟", caption: original, cta: "احجز التقييم المجاني" });
  assert.equal(copy.headline, "هل طفلك يخاف من الماء؟");
  assert.equal(copy.body, "سؤال: هل طفلك يخاف من الماء؟\nإجابة: ابدأ بخطوات هادئة وبسيطة.");
  assert.equal(copy.cta, "احجز التقييم المجاني");
  assert.doesNotMatch(copy.body, /0–2s|3–8s|child a9–10s|058 821 9130/);
  assert.equal(original.includes("0–2s"), true);
});

test("Canva copy supports English and mixed-language content without incomplete fragments", () => {
  const copy = prepareCanvaCopy({
    hook: "Calm progress starts with one skill",
    caption: "VIDEO BRIEF: Short Reel (10s)\n0–2s: title card\n3–8s: show child a9–10s\nOne calm skill at a time. احفظي هذه النصيحة.",
    cta: "Book a free assessment",
  });
  assert.equal(copy.headline, "Calm progress starts with one skill");
  assert.equal(copy.body, "One calm skill at a time. احفظي هذه النصيحة.");
  assert.doesNotMatch(copy.body, /VIDEO BRIEF|0–2s|3–8s|a9–10s/);
});

test("Canva autofill uses confirmed field names and rejects an unsuitable template", () => {
  const copy = prepareCanvaCopy({ hook: "عنوان واضح", caption: "محتوى قصير ومفهوم.", cta: "ابدأ الآن" });
  const result = buildStrictAutofillData({ hook: { type: "text" }, caption: { type: "text" }, cta: { type: "text" }, image: { type: "image" } }, copy, "asset-1");
  assert.deepEqual(result.data, {
    hook: { type: "text", text: "عنوان واضح" },
    caption: { type: "text", text: "محتوى قصير ومفهوم." },
    cta: { type: "text", text: "ابدأ الآن" },
    image: { type: "image", asset_id: "asset-1" },
  });
  assert.equal(buildStrictAutofillData({ title: { type: "text" }, body: { type: "text" }, image: { type: "image" } }, copy).error, "TEMPLATE_FIELDS_INVALID");
  assert.match(edge, /buildStrictAutofillData/);
  assert.match(edge, /prepareCanvaCopy/);
  assert.match(adapter, /caption: item\.caption/);
});
