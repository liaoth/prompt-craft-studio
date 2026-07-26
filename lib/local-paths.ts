import path from "node:path";

const DATA_DIRECTORY_NAME = "data";

export function localDataDirectory(): string {
  const configured = process.env.PROMPT_CRAFT_DATA_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), DATA_DIRECTORY_NAME);
}

export function localDatabasePath(): string {
  return path.join(localDataDirectory(), "prompt-craft.db");
}

export function localEncryptionKeyPath(): string {
  return path.join(localDataDirectory(), "local.key");
}
