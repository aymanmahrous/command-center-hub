import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const distDirectory = resolve(process.env.PERFORMANCE_DIST_DIR ?? "dist");
const indexPath = resolve(distDirectory, "index.html");
const budgets = {
  js: { raw: 336_000, gzip: 98_200 },
  css: { raw: 25_000, gzip: 6_000 },
};

if (!existsSync(indexPath)) {
  throw new Error(`Performance budget requires a built index at ${indexPath}`);
}

const html = readFileSync(indexPath, "utf8");
const resourcePaths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)]
  .map((match) => match[1])
  .filter((value, index, values) => values.indexOf(value) === index);

const totals = { js: { raw: 0, gzip: 0 }, css: { raw: 0, gzip: 0 } };

for (const resourcePath of resourcePaths) {
  const relativePath = resourcePath.replace(/^\/+/, "");
  const assetPath = resolve(distDirectory, relativePath);
  if (!assetPath.startsWith(`${distDirectory}${sep}`) || !existsSync(assetPath)) {
    throw new Error(`Performance budget could not resolve ${resourcePath} inside dist`);
  }

  const extension = relativePath.endsWith(".css") ? "css" : "js";
  const contents = readFileSync(assetPath);
  totals[extension].raw += statSync(assetPath).size;
  totals[extension].gzip += gzipSync(contents).length;
}

if (totals.js.raw === 0) throw new Error("Performance budget found no initial JavaScript entry");

let exceeded = false;
for (const extension of ["js", "css"]) {
  const result = totals[extension];
  const limit = budgets[extension];
  console.log(`${extension.toUpperCase()} initial: ${result.raw} bytes raw / ${result.gzip} bytes gzip`);
  if (result.raw > limit.raw || result.gzip > limit.gzip) {
    console.error(`${extension.toUpperCase()} budget exceeded: limits are ${limit.raw} raw / ${limit.gzip} gzip bytes`);
    exceeded = true;
  }
}

if (exceeded) process.exitCode = 1;
