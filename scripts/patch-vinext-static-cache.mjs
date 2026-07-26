import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.resolve(
  "node_modules/vinext/dist/server/static-file-cache.js",
);
const source = await readFile(target, "utf8");
const original = "relativePath: path.relative(base, batch[j]),";
const patched =
  'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),';

if (!source.includes(patched) && !source.includes(original)) {
  throw new Error(
    "vinext static cache implementation changed; review the Windows path patch.",
  );
}

if (!source.includes(patched)) {
  await writeFile(target, source.replace(original, patched), "utf8");
  console.log("Applied vinext Windows static asset path patch.");
}

const braceTarget = path.resolve(
  "node_modules/brace-expansion/dist/commonjs/index.js",
);
const braceSource = await readFile(braceTarget, "utf8");
const braceMarker = "// Prompt Craft CommonJS compatibility adapter";
if (!braceSource.includes(braceMarker)) {
  const adapter = `

${braceMarker}
// minimatch 3 expects the legacy callable CommonJS export. Keep the named
// properties as well so current consumers can continue to destructure them.
module.exports = expand;
module.exports.expand = expand;
module.exports.EXPANSION_MAX = exports.EXPANSION_MAX;
module.exports.EXPANSION_MAX_LENGTH = exports.EXPANSION_MAX_LENGTH;
`;
  await writeFile(braceTarget, `${braceSource}${adapter}`, "utf8");
  console.log("Applied brace-expansion CommonJS compatibility adapter.");
}
