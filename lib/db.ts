import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL 未配置，数据库功能暂不可用。");
  }
  return value;
}

export function getPool(): Pool {
  pool ??= new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  database ??= drizzle(getPool(), { schema });
  return database;
}

/**
 * Better Auth needs an adapter at module construction time. This proxy defers
 * creating a pg Pool until the first real database operation, so static builds
 * and UI-only development do not require DATABASE_URL.
 */
export const lazyDb = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, property) {
    const db = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(db, property);
    return typeof value === "function" ? value.bind(db) : value;
  },
});
