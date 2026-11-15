import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// #83 — package.json is `"type": "module"` and exports `./dist/index.js` as
// `"default"`. Babel must leave that file as ESM; CommonJS (`exports` /
// `require` / `module.exports`) breaks Node, tsx, and esbuild without the
// `solid` condition.
const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
const src = readFileSync(dist, "utf8");

const cjsPatterns = [
  /Object\.defineProperty\(\s*exports\b/,
  /^\s*exports\./m,
  /\bmodule\.exports\b/,
  /\brequire\s*\(/
];

if (cjsPatterns.some((re) => re.test(src))) {
  console.error("dist/index.js is CommonJS; expected ESM (see solidjs/solid-meta#83)");
  process.exit(1);
}

if (!/\bexport\s+(?:\{|var|let|const|function|class|default)\b/.test(src)) {
  console.error("dist/index.js has no ESM export declarations");
  process.exit(1);
}

console.log("dist/index.js is ESM");
