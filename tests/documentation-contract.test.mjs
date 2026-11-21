import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const readRepositoryFile = (path) => readFile(resolve(repositoryRoot, path), "utf8");

test("canonical repository rules and current state use the archive", async () => {
  const [readme, rules, handoff] = await Promise.all([
    readRepositoryFile("README.md"),
    readRepositoryFile("AGENTS.md"),
    readRepositoryFile("MASTER_PROJECT_HANDOFF.md"),
  ]);

  assert.match(readme, /AGENTS\.md/);
  assert.match(readme, /MASTER_PROJECT_HANDOFF\.md/);
  assert.match(readme, /docs\/archive\//);
  assert.match(rules, /قواعد العمل الوحيدة/);
  assert.match(rules, /MASTER_PROJECT_HANDOFF\.md/);
  assert.match(handoff, /الحالة الحالية المثبتة/);
  assert.match(handoff, /غير مثبت/);
  assert.match(handoff, /الخطوة الآمنة التالية/);

  const archiveEntries = await readdir(resolve(repositoryRoot, "docs/archive"), { withFileTypes: true });
  for (const directory of ["rules", "handoffs", "plans"]) {
    assert.ok(archiveEntries.some((entry) => entry.isDirectory() && entry.name === directory), `missing docs/archive/${directory}`);
  }
  await access(resolve(repositoryRoot, "docs/archive/handoffs/MASTER_PROJECT_HANDOFF.pre-consolidation-2026-11-18.md"));
  await access(resolve(repositoryRoot, "docs/archive/rules/clinerules.pre-consolidation-2026-11-18.txt"));
});

test("all relative Markdown links resolve inside the repository", async () => {
  const rootFiles = (await readdir(repositoryRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(repositoryRoot, entry.name));
  const docsDirectory = resolve(repositoryRoot, "docs");
  const docsFiles = (await readdir(docsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(docsDirectory, entry.name));

  for (const markdownPath of [...rootFiles, ...docsFiles]) {
    const markdown = await readFile(markdownPath, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split("#", 1)[0];
      if (!target || /^(?:https?:|mailto:)/i.test(target)) continue;
      const resolvedTarget = resolve(dirname(markdownPath), decodeURIComponent(target));
      const repositoryRelative = relative(repositoryRoot, resolvedTarget);
      assert.ok(!repositoryRelative.startsWith("..") && !isAbsolute(repositoryRelative), `${match[1]} escapes the repository from ${markdownPath}`);
      await access(resolvedTarget);
    }
  }
});
