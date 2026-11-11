import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const adapter = await readFile(new URL("../src/gemini-batch-adapter.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/generate-content-batch/index.ts", import.meta.url), "utf8");
const researchEdge = await readFile(new URL("../supabase/functions/coach-brain-research/index.ts", import.meta.url), "utf8");
const slotSpec = await readFile(new URL("../supabase/functions/generate-content-batch/coach-ayman-slot-spec.ts", import.meta.url), "utf8");
const generator = await readFile(new URL("../src/content-batch-generator.ts", import.meta.url), "utf8");
const hub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const coachBrain = await readFile(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");

function functionsFrom(sourceText, names) {
  const source = ts.createSourceFile("source.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) declarations.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(declarations.length, names.length, "all production functions must be present");
  return ts.transpileModule(declarations.map((node) => node.getText(source).replace(/^export /, "")).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
}

const promptFunctions = functionsFrom(edge, ["boundedText", "asObject", "stringList", "sanitizePromptContext", "buildPrompt"]);

test("Factory passes the owner's selected provider to batch generation", async (t) => {
  const source = ts.createSourceFile("content-growth-hub.tsx", hub, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let generationHandler;
  let providerChangeHandler;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "generateCoachAymanBatch") generationHandler = node;
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === "select") {
      const attributes = node.attributes.properties;
      const value = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "value");
      if (value?.initializer?.expression?.getText(source) === "batchAiProvider") {
        const change = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "onChange");
        providerChangeHandler = change?.initializer?.expression;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(generationHandler, "execute the real Factory generation handler");
  assert.ok(providerChangeHandler, "execute the existing provider dropdown handler");
  const executable = ts.transpileModule(
    `${generationHandler.getText(source)}\nconst changeProvider = ${providerChangeHandler.getText(source)};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;

  for (const [selected, execution] of [["openai", "best"], ["gemini", "best"], ["auto", "best"], ["openai", "value"]]) {
    await t.test(`${selected} → ${selected} (planExecution=${execution})`, async () => {
      const session = { accessToken: "local-test-only" };
      const providerCalls = [];
      const rpcCalls = [];
      const sandbox = {
        canWrite: true, panelBusy: false, planExecution: execution, batchAiProvider: "auto",
        session, planWindowDays: 10, planFocus: "varied", coachBrainContext: { question: "Swimming plan", answer: "Research", sources: [], contentGoal: "  بناء ثقة الطفل بالماء " + "x".repeat(600) },
        BRAND: {}, PLATFORM_GUIDANCE: {}, strategySummary: {}, insights: [],
        COACH_AYMAN_PROVIDER_ID: "test-provider",
        copy: { generateConfirm: "Confirm", generateFallback: "Fallback {batchId}", generateSuccess: "AI {batchId}", generateError: "Failed" },
        window: { confirm: () => true }, crypto: { randomUUID: () => "test-nonce" },
        setBatchAiProvider(value) { sandbox.batchAiProvider = value; },
        readAiProviderPreference: () => selected === "gemini" ? "openai" : "gemini",
        async generateCoachAymanBatchWithProvider(...args) {
          providerCalls.push(args);
          const adapterFunctions = functionsFrom(adapter, ["callGenerateContentBatchEdge", "generateCoachAymanBatchWithProvider"]);
          let sentBody;
          const generate = runInNewContext(`${adapterFunctions}\ngenerateCoachAymanBatchWithProvider;`, {
            SUPABASE_URL: "https://local.test", SUPABASE_PUBLIC_KEY: "local-public-test",
            fetch: async (_url, options) => {
              sentBody = JSON.parse(options.body);
              return { status: 200, json: async () => ({ items: [], success: false, code: "NEEDS_CREDENTIAL" }) };
            },
          });
          await generate(...args);
          assert.equal(sentBody.provider, selected);
          const prompt = runInNewContext(`${promptFunctions}\nbuildPrompt("nonce", "2026-11-11", sanitizePromptContext(input), []);`, { input: sentBody.promptContext });
          const expectedGoal = sandbox.coachBrainContext.contentGoal.trim().slice(0, 500);
          assert.ok(prompt.includes(`OWNER CONTENT GOAL:`));
          assert.ok(prompt.includes(JSON.stringify(expectedGoal)), "Factory goal survives the adapter and sanitizer into generation instructions");
          assert.ok(!prompt.includes(sandbox.coachBrainContext.contentGoal.trim()), "goal is bounded to 500 characters");
          assert.ok(prompt.includes("FINAL LOCK:"), "goal cannot override canonical safety rules");
          return null;
        },
        async callRpc(_session, name) {
          rpcCalls.push(name);
          if (name === "get_staff_media_assets") return [];
          if (name === "get_staff_knowledge_management") return null;
          if (name === "create_staff_generated_content_batch") return { success: true, batchId: "test-batch" };
          throw new Error(`Unexpected RPC: ${name}`);
        },
        parseMediaAssetRecords: (value) => value,
        parseCoachKnowledgeContext: () => ({ entries: [], researchContext: null }),
        buildCoachAyman30DayBatchWithMedia: async () => [],
        fitBatchToPlanWindow: (items) => items,
        mergeValidatedGeminiCreativeFields: async () => null,
        clearCoachBrainFactoryHandoff() {}, setGenerating() {}, setGenerateNotice() {},
        setSelectedBatchId() {}, setMediaAssets() {}, onBatchCreated() {},
        onSessionExpired() { assert.fail("no external session should be used"); },
      };
      const handlers = runInNewContext(`${executable}\n({ changeProvider, generateCoachAymanBatch });`, sandbox);
      handlers.changeProvider({ target: { value: selected } });
      assert.equal(sandbox.batchAiProvider, selected);
      await handlers.generateCoachAymanBatch();
      assert.equal(providerCalls.length, 1, "the actual provider boundary must be reached exactly once");
      assert.equal(providerCalls[0][0], session);
      assert.equal(providerCalls[0][1], selected);
      assert.equal(providerCalls[0][2], "test-nonce");
      assert.deepEqual(rpcCalls, ["get_staff_media_assets", "get_staff_knowledge_management", "create_staff_generated_content_batch"]);
    });
  }
});

test("OpenAI status verifies authentication and configured model without generation or secret disclosure", async (t) => {
  const executable = functionsFrom(edge, ["asObject", "credentialStatus", "verifyGeminiCredential", "verifyOpenAICredential", "generationStatus"]);
  const cases = [
    { name: "missing key", key: "", code: "NEEDS_CREDENTIAL", calls: 0 },
    { name: "invalid key", status: 401, data: { error: { code: "invalid_api_key", message: "never expose upstream text" } }, code: "OPENAI_INVALID_KEY" },
    { name: "other authentication rejection", status: 401, data: {}, code: "OPENAI_AUTH_REJECTED" },
    { name: "access denied", status: 403, code: "OPENAI_ACCESS_DENIED" },
    { name: "rate limited", status: 429, code: "OPENAI_RATE_LIMITED" },
    { name: "service failure", status: 503, code: "OPENAI_SERVICE_FAILED" },
    { name: "network or timeout", throws: true, code: "OPENAI_CONNECTION_FAILED" },
    { name: "malformed response", status: 200, data: {}, code: "OPENAI_INVALID_STATUS_RESPONSE" },
    { name: "invalid JSON", status: 200, badJson: true, code: "OPENAI_INVALID_STATUS_RESPONSE" },
    { name: "model unavailable", status: 200, data: { data: [{ id: "other-model" }] }, code: "OPENAI_MODEL_UNAVAILABLE", authenticated: true },
    { name: "configured model available", status: 200, data: { data: [{ id: "configured-model" }] }, code: "EXTERNAL_CHECK_PASSED", authenticated: true, available: true },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const calls = [];
      const key = scenario.key ?? "synthetic-credential-never-echo";
      const check = runInNewContext(`${executable}\ngenerationStatus;`, {
        OPENAI_API_KEY: key, OPENAI_MODEL: "configured-model", GEMINI_API_KEY: "configured-but-not-selected", GEMINI_MODEL: "gemini-test", AbortSignal,
        console: { log() { assert.fail("status must not log"); }, error() { assert.fail("status must not log"); } },
        fetch: async (url, options) => {
          calls.push(url);
          assert.equal(url, "https://api.openai.com/v1/models");
          assert.equal(options.method, "GET");
          assert.equal(options.headers.Authorization, `Bearer ${key}`);
          assert.equal(options.body, undefined);
          assert.equal(options.redirect, "error");
          if (scenario.throws) throw new Error(key);
          return { ok: scenario.status === 200, status: scenario.status, json: async () => {
            if (scenario.badJson) throw new Error(key);
            return scenario.data;
          } };
        },
      });
      const result = await check("openai");
      assert.equal(calls.length, scenario.calls ?? 1);
      assert.equal(result.code, scenario.code);
      assert.equal(result.credentialVerified, scenario.authenticated ?? false);
      assert.equal(result.modelAvailable, scenario.available ?? false);
      assert.equal(result.externalCheck, !key ? "NOT RUN" : scenario.available ? "PASSED" : "FAILED");
      assert.equal(result.functionVerified, false);
      assert.equal(result.connected, false);
      assert.ok(result.detail.length > 20);
      assert.ok(!JSON.stringify(result).includes(key || "never expose upstream text"));
      assert.ok(!JSON.stringify(result).includes("never expose upstream text"));
      let notice;
      let busy;
      const ui = runInNewContext(`${functionsFrom(hub, ["checkSelectedProvider"])}\ncheckSelectedProvider;`, {
        canWrite: true, panelBusy: false, session: { accessToken: "local-only" }, batchAiProvider: "openai", language: "ar",
        setCheckingProvider(value) { busy = value; },
        setGenerateNotice(value) { notice = value; },
        fetchGeminiBatchGenerationStatus: async (session, provider) => {
          const statusAdapter = runInNewContext(`${functionsFrom(adapter, ["callGenerateContentBatchEdge", "fetchGeminiBatchGenerationStatus"])}\nfetchGeminiBatchGenerationStatus;`, {
            SUPABASE_URL: "https://local.test", SUPABASE_PUBLIC_KEY: "test-public",
            fetch: async (_url, options) => {
              assert.deepEqual(JSON.parse(options.body), { mode: "status", provider: "openai" });
              return { status: 200, json: async () => result };
            },
          });
          return statusAdapter(session, provider);
        },
      });
      await ui();
      assert.equal(notice, result.detail, "the owner sees the safe and specific status message");
      assert.equal(busy, false, "the UI check lock is released");
    });
  }
});

test("gemini batch adapter calls server edge function only", () => {
  assert.match(adapter, /functions\/v1\/generate-content-batch/);
  assert.match(adapter, /generateCoachAymanBatchWithGemini/);
  assert.match(adapter, /generateCoachAymanBatchWithProvider/);
  assert.match(adapter, /BatchAiProvider/);
  assert.doesNotMatch(adapter, /GEMINI_API_KEY|VITE_GEMINI/i);
});

test("generate-content-batch edge function keeps Gemini key server-side", () => {
  assert.match(edge, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.match(edge, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(edge, /api\.openai\.com\/v1\/responses/);
  assert.match(edge, /requestedProvider/);
  assert.match(edge, /body\.mode !== "generate" && body\.mode !== "sample"/);
  assert.match(edge, /Relax Fix UAE Swimming Academy/);
  assert.match(edge, /coach-ayman-slot-spec\.ts/);
  assert.match(edge, /captionBody/);
  assert.match(edge, /ensureMediaBrief/);
});

test("gemini slot spec aligns with local batch strategy mix", () => {
  assert.match(slotSpec, /COACH_AYMAN_SLOT_SPEC/);
  assert.match(slotSpec, /contentType: "reel"/);
  assert.match(slotSpec, /contentType: "carousel"/);
  assert.match(slotSpec, /contentType: "post"/);
  assert.match(slotSpec, /strategyLabel: "Short Reel — common swimming problem"/);
  assert.match(slotSpec, /strategyLabel: "Trust \+ Conversion"/);
  assert.match(slotSpec, /buildVideoBrief/);
  assert.match(slotSpec, /VIDEO BRIEF:/);
  assert.match(slotSpec, /primaryCtaKey: "book"/);
  assert.match(slotSpec, /FORMAT:/);
  assert.match(slotSpec, /CANVA:/);
  assert.match(slotSpec, /CAPCUT:/);
  assert.match(slotSpec, /RUNWAY \(optional\)/);
  assert.match(generator, /contentType: "reel"/);
  assert.match(generator, /buildVideoBrief/);
  assert.match(generator, /primaryCta: PRIMARY_CTAS\.book/);
  assert.doesNotMatch(slotSpec, /platform: "tiktok"/);
});

test("content growth hub generates 30-day local calendar with media linkage", () => {
  assert.match(hub, /buildCoachAyman30DayBatchWithMedia/);
  assert.match(hub, /create_staff_generated_content_batch/);
  assert.match(hub, /batchAiProvider/);
  assert.match(hub, /Auto — best available/);
});

test("existing Coach Brain, Academy, business and performance context reaches the Gemini prompt", () => {
  assert.match(coachBrain, /answer: result\?\.answer\?\.slice\(0, 4000\)/);
  assert.match(hub, /academyKnowledge: knowledgeContext\.entries/);
  assert.match(hub, /coachBrainResearch: knowledgeContext\.researchContext \?\? null/);
  assert.match(hub, /businessStrategy: \{ brand: BRAND, platformGuidance: PLATFORM_GUIDANCE, strategySummary: \{ \.\.\.strategySummary, currentBatchStrategy: planFocus \} \}/);
  assert.match(hub, /performanceGuidance: insights/);
  assert.match(adapter, /promptContext: promptContext \?\? null/);
  assert.match(edge, /sanitizePromptContext\(body\.promptContext\)/);
  assert.match(edge, /CANONICAL ACADEMY KNOWLEDGE/);
  assert.match(edge, /COACH BRAIN RESEARCH/);
  assert.match(edge, /CANONICAL BUSINESS FACTS AND PLATFORM STRATEGY/);
  assert.match(edge, /EXISTING FACTORY STRATEGY SUMMARY/);
  assert.match(edge, /PERFORMANCE GUIDANCE/);
});

test("Gemini creative output cannot override main slots, CTAs, security checks or media fallback", () => {
  assert.match(hub, /generated\.contentType === canonical\.contentType/);
  assert.match(hub, /generated\.contentPillar === canonical\.contentPillar/);
  assert.match(hub, /generated\.contentSlot === canonical\.contentSlot/);
  assert.match(hub, /generated\.cta === canonical\.cta/);
  assert.match(hub, /validateCoachAymanBatch\(merged\)\.valid/);
  assert.match(hub, /const validatedAiItems = await mergeValidatedGeminiCreativeFields/);
  assert.match(hub, /const items = validatedAiItems \?\? windowedCanonicalItems/);
  assert.match(hub, /usedAiGeneration = validatedAiItems !== null/);
  assert.match(edge, /context may influence only topic, hook, captionBody, and visualPrompt/i);
});

test("Factory lets the owner choose a scheduling window without creating a second system", () => {
  assert.match(hub, /PLAN_WINDOW_OPTIONS/);
  assert.match(hub, /planWindowDays/);
  assert.match(hub, /fitBatchToPlanWindow/);
  assert.match(hub, /COACH BRAIN PLAN/);
  assert.match(hub, /DEFAULT_BATCH_MIX\.length/);
  assert.match(hub, /1, 2, 3, 4, 5, 6, 7, 8, 9, 10/);
});


test("Coach Brain can generate one real non-persisted sample and carry the owner plan", () => {
  assert.match(adapter, /generateCoachAymanSampleWithProvider/);
  assert.match(adapter, /mode: "sample"/);
  assert.match(edge, /body\.mode === "sample"/);
  assert.match(edge, /sampleSlot/);
  assert.match(edge, /expectedCount/);
  assert.match(coachBrain, /Show a real sample|شاهد عينة حقيقية/);
  assert.match(coachBrain, /planWindowDays/);
  assert.match(coachBrain, /planExecution/);
  assert.match(hub, /planDays/);
  assert.match(hub, /planFocus/);
  assert.match(hub, /get_staff_integrations/);
  assert.match(hub, /canvaIntegration/);
});

test("Coach Brain research output is rendered as safe plain text", () => {
  assert.match(coachBrain, /coach-brain__structured-output/);
  assert.match(coachBrain, /whiteSpace: "pre-wrap"/);
  assert.match(coachBrain, /overflowWrap: "anywhere"/);
  assert.match(coachBrain, /result\.answer/);
  assert.doesNotMatch(coachBrain, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(coachBrain, /Summary content|Next step rationale|Cost, risks & constraints/);
  assert.match(researchEdge, /الخلاصة والرأي الموصى به/);
});

test("Existing Coach Brain research and academy context is passed through the current Gemini path", () => {
  assert.match(hub, /coachBrainResearch: knowledgeContext\.researchContext \?\? null/);
  assert.match(adapter, /promptContext: promptContext \?\? null/);
  assert.match(edge, /sanitizePromptContext\(body\.promptContext\)/);
  assert.match(edge, /CANONICAL ACADEMY KNOWLEDGE/);
  assert.match(edge, /COACH BRAIN RESEARCH/);
  assert.match(edge, /CANONICAL BUSINESS FACTS AND PLATFORM STRATEGY/);
  assert.match(edge, /EXISTING FACTORY STRATEGY SUMMARY/);
  assert.match(edge, /PERFORMANCE GUIDANCE/);
});
