import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOutdatedDependencies } from "../scripts/dependency-paths.mjs";

const root = "command-center-hub";

test("shared dependency keeps root and transitive wanted versions instead of choosing one arbitrarily", () => {
  const result = normalizeOutdatedDependencies({
    vite: [
      { current: "7.3.6", wanted: "8.3.2", latest: "8.3.2", dependent: "@vitejs/plugin-react", location: "/repo/node_modules/vite" },
      { current: "7.3.6", wanted: "7.3.6", latest: "8.3.2", dependent: root, location: "/repo/node_modules/vite" },
    ],
    "@types/node": [
      { current: "22.20.1", wanted: "26.6.3", latest: "26.6.3", dependent: "vite", location: "/repo/node_modules/@types/node" },
      { current: "22.20.1", wanted: "22.20.4", latest: "26.6.3", dependent: root, location: "/repo/node_modules/@types/node" },
    ],
    zod: [
      { current: "3.25.76", wanted: "3.25.76", latest: "4.6.5", dependent: "relaxfix-command-center-hub", location: "/repo/node_modules/zod" },
    ],
  }, [root, "relaxfix-command-center-hub"]);

  const vite = result.find((entry) => entry.name === "vite");
  assert.deepEqual(vite.projectWants, [{ dependent: root, wanted: "7.3.6" }]);
  assert.deepEqual(vite.requests, [{ dependent: "@vitejs/plugin-react", wanted: "8.3.2" }]);

  const nodeTypes = result.find((entry) => entry.name === "@types/node");
  assert.deepEqual(nodeTypes.projectWants, [{ dependent: root, wanted: "22.20.4" }]);
  assert.deepEqual(nodeTypes.requests, [{ dependent: "vite", wanted: "26.6.3" }]);

  const zod = result.find((entry) => entry.name === "zod");
  assert.deepEqual(zod.projectWants, [{ dependent: "relaxfix-command-center-hub", wanted: "3.25.76" }]);
});

test("different installed copies remain separate and not-installed platform optionals are omitted", () => {
  const result = normalizeOutdatedDependencies({
    nanoid: [
      { current: "3.3.16", wanted: "3.3.19", latest: "6.0.1", dependent: "vite", location: "/repo/node_modules/nanoid" },
      { current: "3.3.20", wanted: "3.3.20", latest: "6.0.1", dependent: "test-tool", location: "/repo/node_modules/test-tool/node_modules/nanoid" },
    ],
    "@esbuild/darwin-arm64": [
      { wanted: "0.28.1", latest: "0.28.2", dependent: "esbuild" },
    ],
  }, root);

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((entry) => entry.current), ["3.3.16", "3.3.20"]);
  assert.ok(result.every((entry) => entry.name === "nanoid"));
});
