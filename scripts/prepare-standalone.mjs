import { cp, lstat, mkdir, readdir, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, "..");
const standaloneRoot = path.join(repositoryRoot, ".next", "standalone");
const serverEntry = path.join(standaloneRoot, "server.js");

if (!(await exists(serverEntry))) {
  throw new Error("Next.js standalone server was not generated.");
}

await rm(path.join(standaloneRoot, "data"), { recursive: true, force: true });
await materializeLinks(standaloneRoot);

await copyDirectory(
  path.join(repositoryRoot, ".next", "static"),
  path.join(standaloneRoot, ".next", "static"),
);
await copyDirectory(
  path.join(repositoryRoot, "public"),
  path.join(standaloneRoot, "public"),
);
await copyDirectory(
  path.join(repositoryRoot, "drizzle"),
  path.join(standaloneRoot, "drizzle"),
);
await mkdir(path.join(standaloneRoot, "scripts"), { recursive: true });
await cp(
  path.join(repositoryRoot, "scripts", "prepare-local-data.mjs"),
  path.join(standaloneRoot, "scripts", "prepare-local-data.mjs"),
  { force: true },
);

for (const entry of await readdir(standaloneRoot, {
  recursive: true,
  withFileTypes: true,
})) {
  if (entry.isFile() && entry.name.startsWith(".env")) {
    const target = path.join(entry.parentPath, entry.name);
    if (path.resolve(target).startsWith(`${path.resolve(standaloneRoot)}${path.sep}`)) {
      await rm(target, { force: true });
    }
  }
}

console.log("Standalone desktop server prepared without environment files.");

async function copyDirectory(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

async function exists(target) {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

async function materializeLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    const info = await lstat(target);
    if (info.isSymbolicLink()) {
      const resolved = await realpath(target);
      const allowedRoot = `${path.resolve(repositoryRoot)}${path.sep}`;
      if (!path.resolve(resolved).startsWith(allowedRoot)) {
        throw new Error(`Standalone link escapes the repository: ${target}`);
      }
      await rm(target, { recursive: true, force: true });
      await cp(resolved, target, { recursive: true, force: true });
      continue;
    }
    if (info.isDirectory()) await materializeLinks(target);
  }
}
