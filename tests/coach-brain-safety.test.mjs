import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import ts from "typescript";
import { BRAND, CONTENT_CYCLE_DAYS, DEFAULT_BATCH_MIX, PLATFORM_GUIDANCE, buildCoachBrainBusinessContext, buildManualDesignPrompt, buildStrategySummary } from "../src/content-strategy.ts";

const view = readFileSync(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/coach-brain.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const handoff = readFileSync(new URL("../src/coach-brain-factory-handoff.ts", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/coach-brain-research/index.ts", import.meta.url), "utf8");

test("Coach Brain uses bounded business strategy from the existing source only for business/content questions", () => {
  const context = buildCoachBrainBusinessContext("Write an Instagram content caption for parents in Abu Dhabi");
  assert.ok(context);
  assert.ok(context.length < 4000);
  const parsed = JSON.parse(context);
  assert.deepEqual(parsed.business, {
    brand: BRAND.name,
    audience: BRAND.audience,
    experience: BRAND.experience,
    offers: BRAND.offers,
    serviceAreas: BRAND.locations,
  });
  assert.equal(parsed.content.cycleDays, CONTENT_CYCLE_DAYS);
  assert.deepEqual(parsed.content.goals, buildStrategySummary([]).goals);
  assert.deepEqual(parsed.content.batchMix, DEFAULT_BATCH_MIX.map(({ pillar, platform, contentType, timeSlot }) => ({ pillar, platform, contentType, timeSlot })));
  assert.deepEqual(parsed.content.platformGuidance, PLATFORM_GUIDANCE);
  assert.doesNotMatch(context, /0588219130|971588219130|0551378660/);
  assert.ok(buildCoachBrainBusinessContext("اكتب منشورًا تسويقيًا للأكاديمية"));
  assert.equal(buildCoachBrainBusinessContext("How can I improve freestyle breathing?"), null);
});

test("Business context is reference-only and cannot override research, medical or water-safety rules", () => {
  assert.match(edge, /buildCoachBrainBusinessContext\(question\)/);
  assert.match(edge, /if \(businessContext\)/);
  assert.match(edge, /reference only; include only for business\/content questions/);
  assert.match(edge, /never override the evidence hierarchy, medical boundaries, or water-safety rules/);
  assert.match(edge, /Do not invent or infer prices, branch names, service details, or packages/);
  assert.match(edge, /tools: \[\{ google_search: \{\} \}\]/);
  assert.match(edge, /Academy Knowledge context:/);
  assert.match(edge, /const GEMINI_MODEL = "gemini-3\.8-flash"/);
  assert.doesNotMatch(edge, /temperature\s*:/);
  assert.ok(edge.indexOf("Do not diagnose ADHD") < edge.indexOf("Business and content strategy context"));
});

test("Coach Brain loads sanitized academy context through the authenticated knowledge RPC and fails closed", async () => {
  const source = ts.createSourceFile("research.ts", edge, ts.ScriptTarget.Latest, true);
  const names = ["sanitizeAcademyText", "buildAcademyContext", "loadAcademyContext"];
  const declarations = source.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(declarations.length, names.length);
  const executable = ts.transpileModule(declarations.map((node) => node.getText(source)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const calls = [];
  let response = new Response(JSON.stringify({ entries: [{ category: "Swimming", question: "Breathing", content: "Practice safely. test@example.com https://example.com" }] }));
  const sandbox = {
    SUPABASE_URL: "https://local-test.invalid", SUPABASE_ANON_KEY: "test-public-key",
    fetch: async (...args) => { calls.push(args); return response; },
  };
  runInNewContext(executable, sandbox);
  const context = await sandbox.loadAcademyContext("test-staff-token");
  assert.match(context, /Category: Swimming/);
  assert.match(context, /Practice safely/);
  assert.doesNotMatch(context, /test@example\.com|https:\/\/example\.com/);
  assert.equal(calls[0][0], "https://local-test.invalid/rest/v1/rpc/get_staff_knowledge_management");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers.apikey, "test-public-key");
  assert.equal(calls[0][1].headers.Authorization, "Bearer test-staff-token");
  assert.deepEqual(JSON.parse(calls[0][1].body), { p_search: null, p_language: null, p_status: "active" });
  response = new Response(JSON.stringify({ entries: [] }));
  assert.equal(await sandbox.loadAcademyContext("test-staff-token"), "Academy context unavailable");
  for (const invalid of [new Response(null, { status: 403 }), new Response("not JSON"), new Response("{}")]) {
    response = invalid;
    await assert.rejects(sandbox.loadAcademyContext("test-staff-token"), /ACADEMY_CONTEXT_FAILED/);
  }
  sandbox.SUPABASE_ANON_KEY = "";
  const count = calls.length;
  await assert.rejects(sandbox.loadAcademyContext("test-staff-token"), /ACADEMY_CONTEXT_FAILED/);
  assert.equal(calls.length, count, "missing credentials must not call the RPC");
});

test("Coach Brain falls back once to OpenAI without changing the safety prompt or inventing sources and cost", async (t) => {
  const source = ts.createSourceFile("research.ts", edge, ts.ScriptTarget.Latest, true);
  const names = ["json", "buildPrompt", "callGemini", "callOpenAI", "callResearchProvider"];
  const declarations = source.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(declarations.length, names.length);
  const executable = ts.transpileModule(declarations.map((node) => node.getText(source)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const scenarios = [
    { name: "no API consent calls no provider", gemini: "ok", openai: "ok", allowApiUsage: false, code: "API_CONSENT_REQUIRED" },
    { name: "Gemini success", gemini: "ok", openai: "ok", expected: "gemini" },
    { name: "no Gemini key", gemini: "missing", openai: "ok", expected: "openai" },
    ...[403, 429, 500, "network", "invalid-json", "empty"].map((gemini) => ({ name: `Gemini ${gemini}`, gemini, openai: "ok", expected: "openai" })),
    { name: "neither credential", gemini: "missing", openai: "missing", code: "NEEDS_CREDENTIAL" },
    { name: "no fallback credential", gemini: 403, openai: "missing", code: "GEMINI_REQUEST_FAILED" },
    { name: "both fail", gemini: 429, openai: 403, code: "OPENAI_REQUEST_FAILED" },
    ...["empty", "invalid-json", "network", "incomplete", "refusal"].map((openai) => ({ name: `OpenAI ${openai}`, gemini: "missing", openai, code: openai === "network" ? "OPENAI_CONNECTION_FAILED" : "OPENAI_EMPTY_RESPONSE" })),
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async () => {
    const calls = [];
    const sandbox = {
      GEMINI_API_KEY: scenario.gemini === "missing" ? "" : "synthetic-gemini-secret",
      OPENAI_API_KEY: scenario.openai === "missing" ? "" : "synthetic-openai-secret",
      GEMINI_MODEL: "gemini-3.8-flash", OPENAI_MODEL: "configured-model", CORS_HEADERS: {}, Response, AbortSignal,
      buildCoachBrainBusinessContext: () => null, buildGeminiUsageSummary: () => ({ requestedModel: "gemini-3.8-flash" }),
      fetch: async (url, options) => {
        const isOpenAI = url === "https://api.openai.com/v1/responses";
        const state = isOpenAI ? scenario.openai : scenario.gemini;
        const body = JSON.parse(options.body);
        calls.push(isOpenAI ? "openai" : "gemini");
        assert.equal(options.method, "POST");
        assert.equal(options.redirect, "error");
        assert.ok(options.signal);
        const prompt = isOpenAI ? body.input : body.contents[0].parts[0].text;
        assert.match(prompt, /Never diagnose medical/);
        assert.match(prompt, /الخلاصة والرأي الموصى به/);
        assert.match(prompt, /أفضل خطوة تالية/);
        assert.match(prompt, /التكلفة المتوقعة والمخاطر/);
        if (isOpenAI) {
          assert.equal(options.headers.Authorization, "Bearer synthetic-openai-secret");
          assert.equal(body.model, "configured-model");
          assert.equal(body.text, undefined, "research preserves the three-part plain text answer, not batch JSON");
        }
        if (state === "network") throw new Error("synthetic-secret-provider-error");
        if (typeof state === "number") return new Response("synthetic-secret-provider-error", { status: state });
        if (state === "invalid-json") return new Response("not JSON");
        if (state === "empty") return new Response("{}");
        return new Response(JSON.stringify(isOpenAI
          ? { status: state === "incomplete" ? "incomplete" : "completed", output: [{ type: "message", content: [{ type: state === "refusal" ? "refusal" : "output_text", text: "Safe answer" }] }] }
          : { candidates: [{ content: { parts: [{ text: "Safe answer" }] } }] }));
      },
    };
    runInNewContext(executable, sandbox);
    const result = await sandbox.callResearchProvider(sandbox.buildPrompt("Swimming question", "Academy context"), scenario.allowApiUsage !== false);
    if (scenario.expected) {
      assert.equal(result.data.answer, "Safe answer");
      assert.equal(calls.at(-1), scenario.expected);
      if (scenario.expected === "openai") {
        assert.equal(result.data.provider, "openai");
        assert.equal(result.data.usage, null);
        assert.equal(result.data.sources.length, 0);
        assert.equal(result.data.searchQueries.length, 0);
      }
    } else {
      const payload = await result.error.json();
      assert.equal(payload.code, scenario.code);
      assert.doesNotMatch(JSON.stringify(payload), /synthetic|secret/);
      if (scenario.allowApiUsage === false) assert.deepEqual(calls, [], "no provider request is made without consent");
    }
    assert.ok(calls.filter((provider) => provider === "openai").length <= 1, "no paid retry loop");
    if (scenario.expected === "gemini") assert.deepEqual(calls, ["gemini"]);
    if (scenario.gemini === "missing") assert.ok(!calls.includes("gemini"));
  });
  assert.match(edge, /callResearchProvider\(buildPrompt\(question, academyContext, referenceAnswer \|\| undefined\), allowApiUsage\)/);
  assert.match(edge, /if \(!GEMINI_API_KEY && !OPENAI_API_KEY\)/);
  const requestHandler = edge.slice(edge.indexOf("Deno.serve("));
  const consentGuard = requestHandler.indexOf('if (!allowApiUsage) return json({ success: false, code: "API_CONSENT_REQUIRED" }, 403)');
  const contextLoad = requestHandler.indexOf("loadAcademyContext(token)");
  assert.ok(consentGuard >= 0 && consentGuard < contextLoad, "reject unapproved API use before loading provider context");
});

test("Coach Brain exposes non-diagnostic safety boundaries", () => {
  assert.match(view, /does not diagnose|لا يشخّص/);
  assert.match(view, /medical treatment|علاجًا طبيًا/);
  assert.match(view, /clinical rehabilitation|التأهيل السريري/);
  assert.match(app, /const CoachBrain = lazy\(\(\) => import\("\.\/coach-brain"\)\)/);
  assert.match(app, /\["brain", Bot, "x"\]/);
  assert.match(app, /<CoachBrain language=\{language\}/);
  assert.match(app, /onNavigate=\{\(section\) =>/);
  assert.match(app, /go\(section as SectionId\)/);
});

test("manual alternatives stay available without research and hand off the original task without an invented answer", () => {
  const panel = readFileSync(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");
  assert.match(view, /href="https:\/\/chatgpt\.com\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(panel, /<textarea readOnly[^>]+value=\{designPrompt\}/);
  assert.match(panel, /handleLinkMedia\(item, selectedAssetByItem\[item.id\]\)/);
  assert.match(panel, /uploadStaffMediaFile/);
  const source = ts.createSourceFile("brain.tsx", view, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "sendResultToFactory") handler = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(handler);
  const executable = ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  let stored;
  let destination;
  const sandbox = {
    question: "Prepare a safe swimming plan", result: null, sample: null, language: "en",
    selectedPlanDays: () => 7, planMix: "varied", planExecution: "manual", URL,
    writeCoachBrainFactoryHandoff: (value) => { stored = JSON.parse(value); },
    readCoachBrainFactoryHandoff: () => stored,
    setError: () => assert.fail("successful handoff should not report an error"),
    window: { location: { href: "https://local-test.invalid/", assign: (url) => { destination = url; } } },
  };
  runInNewContext(executable, sandbox);
  sandbox.sendResultToFactory();
  assert.equal(stored.question, sandbox.question);
  assert.equal(stored.contentGoal, sandbox.question);
  assert.equal(stored.answer, "");
  assert.deepEqual(stored.sources, []);
  assert.equal(new URL(destination).searchParams.get("factoryContext"), "coach-brain");
  stored = null;
  sandbox.question = "  ";
  sandbox.sendResultToFactory();
  assert.equal(stored, null, "empty task must not create a handoff");
});

test("personal-account buttons open the fixed site and copy the displayed text on one click", async () => {
  const panel = readFileSync(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");
  const expectedSites = {
    Canva: "https://www.canva.com/", Gemini: "https://gemini.google.com/", Runway: "https://app.runwayml.com/",
  };
  // Execute the actual JSX controls in isolation, with only clipboard, navigation and status feedback.
  for (const [screen, code] of [["brain", view], ["factory", panel]]) {
    const source = ts.createSourceFile("screen.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declarations = [];
    const controls = [];
    function visit(node) {
      if (ts.isVariableStatement(node) && node.declarationList.declarations.some(({ name }) =>
        ["personalDesignSites", "manualDesignSites", "designPrompt", "questionDesignPrompt", "sampleBasePrompt", "sampleDesignPrompt"].includes(name.getText(source)))) declarations.push(node.getText(source));
      if (ts.isFunctionDeclaration(node) && ["openPersonalDesignSite", "personalDesignButton"].includes(node.name?.text))
        declarations.push(node.getText(source));
      if (ts.isJsxExpression(node) && node.expression) {
        const expression = node.expression.getText(source);
        if (expression.startsWith("personalDesignButton(sampleIsVideo") || expression.startsWith('(["Gemini", "Canva", "Runway"]') || expression.startsWith("manualDesignSites.map("))
          controls.push(expression);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.equal(controls.length, screen === "brain" ? 2 : 1);
    const js = ts.transpileModule(declarations.join("\n") + "\n[" + controls.join(",") + "].flat()", {
      fileName: "controls.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText;
    for (const clipboardState of ["allowed", "denied", "missing"]) {
      const opened = [], copied = [], notices = [];
      const sandbox = {
        React: { createElement }, language: "ar", sampleIsVideo: true, sample: { visualPrompt: "عينة فيديو" }, sampleVideoDuration: 8, buildManualDesignPrompt,
        question: "  سؤال المالك  ", item: { visualPrompt: "تصميم المنشور", caption: "تعليق مختلف" },
        window: { open: (...args) => opened.push(args) },
        navigator: { clipboard: clipboardState === "missing" ? undefined : { writeText: async (text) => {
          copied.push(text);
          if (clipboardState === "denied") throw new Error("NotAllowedError");
        } } },
        setSampleDesignNotice: (text) => notices.push(text), setDesignNotice: (text) => notices.push(text),
      };
      const buttons = runInNewContext(js, sandbox);
      assert.deepEqual(Array.from(buttons, (button) => button.props.children[1]).sort(),
        (screen === "brain" ? ["Canva", "Gemini", "Runway", "Runway"] : ["Canva", "Gemini", "Runway"]));
      for (const [i, button] of buttons.entries()) {
        const [label, site] = button.props.children;
        assert.equal(label, "نسخ البرومبت وفتح ");
        assert.equal(button.props.disabled, false);
        const clicked = button.props.onClick();
        assert.deepEqual(opened.splice(0), [[expectedSites[site], "_blank", "noopener,noreferrer"]]);
        await clicked;
        if (clipboardState === "missing") assert.deepEqual(copied, []);
        else {
          const [prompt] = copied.splice(0);
          assert.ok(prompt.startsWith(screen === "factory" ? sandbox.item.visualPrompt : i === 0 ? sandbox.sample.visualPrompt : sandbox.question.trim()));
          for (const required of [BRAND.name, BRAND.locations[0], BRAND.whatsapp, BRAND.phone, "official Relax Fix UAE logo", "natural lighting", "Never invent customer numbers", "testimonials", "timelines or medical outcomes"]) assert.ok(prompt.includes(required), required);
          if (screen === "brain" && i === 0) assert.match(prompt, /exact target duration of 8 seconds/);
        }
        const hint = screen === "brain" && i === 0 ? /مربع برومبت التصميم/ : /افتح برومبت التصميم/;
        assert.match(notices.shift(), clipboardState === "allowed" ? /تم نسخ/ : hint);
      }
      const empty = runInNewContext(js, { ...sandbox, question: " ", sample: null, item: {} });
      assert.ok(empty.every((button) => button.props.disabled));
    }
  }
});

test("Coach Brain asks before calling a provider and keeps the manual route available", () => {
  const start = view.indexOf("async function research(event: FormEvent)");
  const end = view.indexOf("\n  return (", start);
  const handler = view.slice(start, end);
  const consent = handler.indexOf("window.confirm(");
  const providerRequest = handler.indexOf('await fetch(`${baseUrl}/functions/v1/coach-brain-research`');
  assert.ok(consent >= 0 && consent < providerRequest, "consent must come before the provider request");
  assert.match(handler, /if \(!allowApiUsage\) return;/);
  assert.match(handler, /allowApiUsage,/);
  assert.match(view, /بديل دائم بدون رصيد API/);
});

test("Coach Brain includes a no-forced-submersion boundary", () => {
  assert.match(view, /forced submersion|الغمر القسري/);
});

test("Coach Brain protects the no-record workflow", () => {
  assert.match(view, /No swimmer or child profile is created or stored|لا يتم إنشاء ملف للسباح أو حفظ بيانات الأطفال/);
});

test("Factory restores the persistent Coach Brain handoff and clears it through the shared helper after success", () => {
  assert.match(hub, /readCoachBrainFactoryHandoff\(\)/);
  assert.match(hub, /factoryContext.*coach-brain/);
  assert.match(hub, /get\("factoryContext"\).*coach-brain/);
  assert.match(hub, /clearCoachBrainFactoryHandoff\(\)/);
});

test("Coach Brain hands research to the existing Factory through the shared persistent handoff without direct execution", () => {
  assert.match(handoff, /COACH_BRAIN_FACTORY_HANDOFF_KEY = "coach-brain-factory-handoff"/);
  assert.match(view, /writeCoachBrainFactoryHandoff\(/);
  assert.match(view, /factoryContext.*coach-brain/);
  assert.match(view, /إرسال إلى مصنع المحتوى|Send to Content Factory/);
  assert.doesNotMatch(view, /executeCoachBrainContentGeneration/);
});

test("Coach Brain starts with ready operational actions", () => {
  assert.match(view, /actionsTitle/);
  assert.match(view, /Prepare a 10-day content plan|جهز لي خطة محتوى 10 أيام/);
  assert.match(view, /Review and improve this copy|راجع هذا النص وحسّنه/);
  assert.match(view, /coach-brain__action-grid/);
});

test("Coach Brain is responsive for mobile staff use", () => {
  assert.match(style, /@media\(max-width:800px\)/);
});

test("Coach Brain shows bilingual, explicitly estimated usage and handles missing metadata truthfully", () => {
  assert.match(view, /Gemini usage & estimated cost/);
  assert.match(view, /استخدام Gemini والتكلفة التقديرية/);
  assert.match(view, /Google Search fees are excluded/);
  assert.match(view, /لا يشمل رسوم Google Search/);
  assert.match(view, /payload\.usage \?\? null/);
  assert.match(view, /usageUnavailable/);
  assert.match(view, /pricingSource/);
});

test("Gemini usage is forwarded without logging or returning provider secrets", () => {
  assert.match(edge, /payload\.usageMetadata/);
  assert.match(edge, /buildGeminiUsageSummary/);
  assert.doesNotMatch(edge, /console\.(?:log|error)\([^)]*GEMINI_API_KEY/i);
  const response = edge.match(/return json\(\{ success: true, query: question,[\s\S]*?\}\);/);
  assert.ok(response);
  assert.doesNotMatch(response[0], /GEMINI_API_KEY|GEMINI_SECRET|ACCESS_TOKEN/i);
});
