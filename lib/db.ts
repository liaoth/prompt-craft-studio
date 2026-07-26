import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { pathToFileURL } from "node:url";

import * as schema from "@/db/schema";
import { localDatabasePath } from "@/lib/local-paths";

let client: Client | undefined;
let database: LibSQLDatabase<typeof schema> | undefined;

export function getClient(): Client {
  client ??= createClient({ url: pathToFileURL(localDatabasePath()).href });
  return client;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  database ??= drizzle(getClient(), { schema });
  return database;
}
