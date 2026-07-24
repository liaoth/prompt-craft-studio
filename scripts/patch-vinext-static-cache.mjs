import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.resolve(
  "node_modules/vinext/dist/server/static-file-cache.js",
);
const source = await readFile(target, "utf8");
const original = "relativePath: path.relative(base, batch[j]),";
const patched =
  'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),';

if (source.includes(patched)) {
  process.exit(0);
}
if (!source.includes(original)) {
  throw new Error(
    "vinext static cache implementation changed; review the Windows path patch.",
  );
}

await writeFile(target, source.replace(original, patched), "utf8");
console.log("Applied vinext Windows static asset path patch.");
