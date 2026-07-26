import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, "..");
const buildDirectory = path.join(repositoryRoot, "build");
const svgPath = path.join(buildDirectory, "icon.svg");
const pngPath = path.join(buildDirectory, "icon.png");
const icoPath = path.join(buildDirectory, "icon.ico");
const sizes = [16, 24, 32, 48, 64, 128, 256];

await mkdir(buildDirectory, { recursive: true });
const svg = await readFile(svgPath);
const pngs = await Promise.all(
  sizes.map(async (size) => ({
    size,
    data: await sharp(svg).resize(size, size).png().toBuffer(),
  })),
);

await writeFile(pngPath, pngs.at(-1).data);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
const entries = [];
let offset = header.length + pngs.length * 16;
for (const { size, data } of pngs) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  offset += data.length;
}

await writeFile(icoPath, Buffer.concat([header, ...entries, ...pngs.map(({ data }) => data)]));
console.log(`Generated ${path.relative(repositoryRoot, pngPath)} and ${path.relative(repositoryRoot, icoPath)}.`);
