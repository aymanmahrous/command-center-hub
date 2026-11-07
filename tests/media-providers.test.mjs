import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const providers = await readFile(new URL("../src/media-providers.ts", import.meta.url), "utf8");
const geminiImage = await readFile(new URL("../supabase/functions/generate-gemini-image/index.ts", import.meta.url), "utf8");
const veoVideo = await readFile(new URL("../supabase/functions/generate-veo-video/index.ts", import.meta.url), "utf8");

test("canva stays optional and never blocks fallback plans", () => {
  assert.match(providers, /optional: true/);
  assert.match(providers, /OPTIONAL \/ NOT CONNECTED/);
  assert.match(providers, /do not block batch creation/);
  assert.match(providers, /canvaBrief/);
});

test("future server-side credentials are named without client exposure", () => {
  assert.match(providers, /RUNWAY_API_KEY/);
  assert.match(providers, /BUFFER_ACCESS_TOKEN/);
  assert.match(providers, /N8N_WEBHOOK_URL/);
  assert.doesNotMatch(providers, /VITE_RUNWAY|VITE_BUFFER|VITE_N8N/i);
});

test("capcut remains manual workflow only", () => {
  assert.match(providers, /manual: true/);
  assert.match(providers, /MANUAL/);
  assert.match(providers, /capcutBrief/);
});


test("Gemini image and Veo use the secure provider key while estimates remain non-billable", () => {
  assert.match(geminiImage, /loadAiProviderKeys\(supabase, GEMINI_ENV_API_KEY, ""\)/);
  assert.match(geminiImage, /"x-goog-api-key": geminiKey/);
  assert.ok(geminiImage.indexOf('if (mode === "estimate")') < geminiImage.indexOf("loadAiProviderKeys"));
  assert.match(veoVideo, /loadAiProviderKeys\(supabase, GEMINI_ENV_API_KEY, ""\)/);
  assert.match(veoVideo, /callVeo\(prompt, spec, geminiKey\)/);
  assert.match(veoVideo, /pollVeo\(started\.operationName, geminiKey\)/);
  assert.match(veoVideo, /started\.operationName,\n    geminiKey,/);
  assert.match(veoVideo, /body\.mode === "estimate"/);
  assert.ok(veoVideo.indexOf('if (body.mode === "estimate")') < veoVideo.indexOf("loadAiProviderKeys"));
  assert.match(veoVideo, /if \(!geminiKey\) return json/);
  assert.doesNotMatch(veoVideo, /if \(!GEMINI_API_KEY\)/);
});
