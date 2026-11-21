import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const adapter = await readFile(new URL("../src/canva-adapter.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/canva-oauth/index.ts", import.meta.url), "utf8");
const providers = await readFile(new URL("../src/media-providers.ts", import.meta.url), "utf8");
const controls = await readFile(new URL("../src/media-library-controls.tsx", import.meta.url), "utf8");

test("canva adapter stays server-side and never embeds client secrets", () => {
  assert.match(adapter, /functions\/v1\/canva-oauth/);
  assert.match(adapter, /startCanvaConnect/);
  assert.match(adapter, /fetchCanvaIntegrationStatus/);
  assert.doesNotMatch(adapter, /VITE_CANVA|CANVA_CLIENT_SECRET|localStorage/i);
});

test("canva oauth edge function uses server secrets and PKCE state", () => {
  assert.match(edge, /Deno\.env\.get\("CANVA_CLIENT_ID"\)/);
  assert.match(edge, /Deno\.env\.get\("CANVA_CLIENT_SECRET"\)/);
  assert.match(edge, /code_challenge_method/);
  assert.match(edge, /staff_canva_oauth_states/);
  assert.match(edge, /staff_canva_tokens/);
  assert.match(edge, /brandtemplate:content:read asset:write asset:read/);
  assert.match(edge, /url\.searchParams\.has\("code"\)/);
  assert.match(edge, /redirectUriCandidates/);
  assert.match(edge, /section", "media"/);
  assert.doesNotMatch(edge, /console\.log\(.*CANVA_CLIENT_SECRET/i);
});

test("canva adapter exposes user-facing connect error messages", () => {
  assert.match(adapter, /canvaConnectErrorMessage/);
  assert.match(adapter, /METHOD_NOT_ALLOWED/);
  assert.match(adapter, /USE_CONNECT_BUTTON/);
});

test("canva remains optional and non-blocking in provider layer", () => {
  assert.match(providers, /optional: true/);
  assert.match(providers, /do not block batch creation/);
  assert.match(providers, /OPTIONAL \/ NOT CONNECTED/);
  assert.match(controls, /Connect Canva/);
  assert.match(controls, /Open Canva/);
  assert.match(controls, /Canva: \{canvaConnected \? "NEEDS ATTENTION"/);
});

test("Canva callback success appears only after the media library confirms the connection", async () => {
  const { outputText } = ts.transpileModule(controls.replaceAll("import.meta.env", "({})"), {
    fileName: "media-library-controls.tsx",
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  });
  const require = createRequire(import.meta.url);
  for (const outcome of ["CONNECTED", "NOT CONNECTED", "rejected"]) {
    const state = [], effects = [];
    let hook = 0;
    const response = Promise.withResolvers();
    const view = { exports: {} };
    runInNewContext(outputText, {
      exports: view.exports, AbortController, URL,
      window: { location: new URL("https://example.invalid/?canva=connected"), history: { replaceState() {} } },
      require(name) {
        if (name === "react") return {
          useState(initial) {
            const index = hook++;
            if (!(index in state)) state[index] = initial;
            return [state[index], (value) => { state[index] = value; }];
          },
          useEffect: (effect) => effects.push(effect),
        };
        if (name === "./i18n") return { useLanguage: () => ({ language: "en" }) };
        if (name === "./canva-adapter") return { readCanvaCallbackNotice: () => "connected", fetchCanvaIntegrationStatus: () => response.promise };
        if (name === "./media-gemini-adapter") return { fetchGeminiIntegrationStatus: async () => ({}) };
        if (name === "./media-providers") return { readMediaProviderStatuses: () => [] };
        return name.startsWith("./") ? {} : require(name);
      },
    });
    function render() {
      hook = 0;
      return renderToStaticMarkup(view.exports.MediaProviderStrip({ session: {} }));
    }
    render();
    effects.splice(0).forEach((effect) => effect());
    assert.doesNotMatch(render(), /Canva connected successfully/);
    if (outcome === "rejected") response.reject(new Error("offline"));
    else response.resolve({ integrationStatus: outcome, detail: "" });
    await new Promise(setImmediate);
    assert.equal(render().includes("Canva connected successfully"), outcome === "CONNECTED");
  }
});
