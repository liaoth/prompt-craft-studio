import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ok } from "@/lib/server/http";

export async function GET() {
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3_000),
      ),
    ]);
    return ok({ status: "ok", database: "connected" });
  } catch {
    return ok(
      { status: "degraded", database: "unavailable" },
      { status: 503 },
    );
  }
}
