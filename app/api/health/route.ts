import { getClient } from "@/lib/db";
import { ok } from "@/lib/server/http";

export async function GET() {
  try {
    await Promise.race([
      getClient().execute("select 1"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3_000),
      ),
    ]);
    return ok({ status: "ok", database: "connected", storage: "sqlite" });
  } catch {
    return ok(
      { status: "degraded", database: "unavailable", storage: "sqlite" },
      { status: 503 },
    );
  }
}
