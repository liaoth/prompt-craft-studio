import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdir, open } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, "..");
const dataDirectory = process.env.PROMPT_CRAFT_DATA_DIR
  ? path.resolve(process.env.PROMPT_CRAFT_DATA_DIR)
  : path.join(repositoryRoot, "data");
const databasePath = path.join(dataDirectory, "prompt-craft.db");
const encryptionKeyPath = path.join(dataDirectory, "local.key");
const migrationsDirectory = process.env.PROMPT_CRAFT_MIGRATIONS_DIR
  ? path.resolve(process.env.PROMPT_CRAFT_MIGRATIONS_DIR)
  : path.join(repositoryRoot, "drizzle");

await mkdir(dataDirectory, { recursive: true });

try {
  const handle = await open(
    encryptionKeyPath,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
    0o600,
  );
  try {
    await handle.writeFile(`${randomBytes(32).toString("base64")}\n`);
  } finally {
    await handle.close();
  }
} catch (error) {
  if (!error || typeof error !== "object" || error.code !== "EEXIST") {
    throw error;
  }
}

const client = createClient({ url: pathToFileURL(databasePath).href });
try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: migrationsDirectory });
} finally {
  await client.close();
}

console.log(`Local data ready: ${path.relative(repositoryRoot, databasePath)}`);

// Electron utility processes retain their parent IPC channel after top-level
// await completes. Explicitly exiting here lets the desktop main process move
// on to launching the local Next.js server.
process.exit(0);
