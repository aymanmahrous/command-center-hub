import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { BRAND } from "../src/content-strategy.ts";

const studio = await readFile(new URL("../src/branded-poster-studio.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

test("poster creation saves to the media library and links the resulting asset to its draft", () => {
  assert.match(studio, /onSaveDesign\?: \(file: File\) => Promise<void>/);
  assert.match(studio, /new File\(\[blob\], fileName, \{ type: "image\/png" \}\)/);
  assert.match(studio, /Save, link & download PNG/);
  assert.match(studio, /Design headline/);
  assert.match(studio, /Key points \(one per line\)/);
  assert.match(studio, /value=\{ratio\} onChange=\{\(event\) => setRatio/);
  assert.match(studio, /ratio === "4:5" \? 1350/);
  assert.match(panel, /onSaveDesign=\{session && canWrite && item\.status !== "published" && presenceByItem\[item.id\] \? \(file\) => handleUploadMedia\(item, file\) : undefined\}/);
  assert.match(panel, /register_staff_media_upload/);
  assert.match(panel, /await linkMediaToItem\(item\.id, newAssetId\)/);
});

const compiledStudio = ts.transpileModule(studio, {
  fileName: "studio.tsx",
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Exercise the studio's actual selection and save buttons with an in-memory canvas.
function mountStudio(language) {
  const commands = [];
  const context = new Proxy({
    measureText: text => ({ width: text.length * 17 }),
    createLinearGradient: () => ({ addColorStop() {} }),
  }, { get: (target, name) => target[name] ?? ((...args) => commands.push([name, ...args])) });
  const canvas = { getContext: () => context, toBlob: callback => callback(new Blob(["local preview"])) };
  const state = [];
  const saved = [];
  let cursor = 0;
  const hooks = {
    useRef: () => ({ current: canvas }),
    useMemo: compute => compute(),
    useLayoutEffect: effect => effect(),
    useState(initial) {
      const index = cursor++;
      if (index >= state.length) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
  };
  const modules = { react: hooks, "react/jsx-runtime": jsx, "./content-strategy": { BRAND }, "lucide-react": {} };
  const exports = {};
  runInNewContext(compiledStudio, { exports, require: name => modules[name], File });
  function render() {
    cursor = 0;
    commands.length = 0;
    const tree = exports.BrandedPosterStudio({
      language, item: { hook: "التنفس في الماء", caption: "- نصيحة أولى\n- نصيحة ثانية", platform: "instagram" },
      onSaveDesign: async file => saved.push(file),
    });
    const elements = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node?.props) return;
      elements.push(node);
      visit(node.props.children);
    }
    visit(tree);
    return elements;
  }
  return { canvas, commands, render, saved };
}

for (const language of ["ar", "en"]) {
  test(`four selectable poster styles retain all formats, branding and booking details (${language})`, async () => {
    const { canvas, commands, render, saved } = mountStudio(language);
    const names = language === "ar" ? ["فاخر حديث", "رياضي نشيط", "تعليمي نظيف", "عائلي دافئ"]
      : ["Modern Luxury", "Sporty Dynamic", "Clean Editorial", "Warm Family"];
    const styleButtons = elements => elements.filter(node => "aria-pressed" in node.props);
    for (const [ratio, height] of [["1:1", 1080], ["4:5", 1350], ["9:16", 1920]]) {
      render().find(node => node.type === "select").props.onChange({ target: { value: ratio } });
      const geometry = new Set();
      for (const [index, name] of names.entries()) {
        const choices = styleButtons(render());
        assert.deepEqual(choices.map(button => button.props.children.at(-1)), names);
        choices[index].props.onClick();
        const elements = render();
        const selected = styleButtons(elements).filter(button => button.props["aria-pressed"]);
        assert.deepEqual(selected.map(button => button.props.children.at(-1)), [name]);
        assert.deepEqual([canvas.width, canvas.height], [1080, height]);
        assert.equal(elements.find(node => node.type === "canvas").props.ref.current, canvas);
        const lines = commands.filter(([op]) => op === "fillText");
        for (const text of [BRAND.publicLine, language === "ar" ? "المشرف · أبوظبي" : BRAND.locations[0],
          BRAND.whatsapp, BRAND.phone, "التنفس في الماء", "نصيحة أولى", "نصيحة ثانية"]) {
          assert.ok(lines.some(([, value]) => value.includes(text)), text);
        }
        assert.ok(lines.every(([, , x, y]) => x > 0 && x < canvas.width && y > 0 && y < height));
        assert.ok(commands.some(([op, , , radius]) => op === "arc" && radius === 6), "swimmer emblem");
        geometry.add(JSON.stringify(commands.filter(([op]) => op !== "fillText")));
        elements.find(node => node.type === "button" && node.props.children.includes(language === "ar" ? "حفظ وربط بالمسودة" : "Save to draft")).props.onClick();
        assert.equal(saved.at(-1)?.type, "image/png");
        assert.ok(saved.at(-1).name.includes(ratio.replace(":", "x")));
      }
      assert.equal(geometry.size, 4, "each style needs distinct geometry as well as a palette");
    }
    assert.equal(saved.length, 12);
  });
}
