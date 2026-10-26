import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const edgeFunctionPaths = [
  "../supabase/functions/canva-design/index.ts",
  "../supabase/functions/analyze-staff-media/index.ts",
  "../supabase/functions/generate-content-batch/index.ts",
  "../supabase/functions/content-automation-pulse/index.ts",
  "../supabase/functions/generate-gemini-image/index.ts",
];

test("Canva and Gemini Edge Functions have valid TypeScript syntax", async () => {
  for (const path of edgeFunctionPaths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const result = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });

    const syntaxDiagnostics = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(
      syntaxDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
      [],
      `${path} contains TypeScript syntax errors`,
    );
  }
});