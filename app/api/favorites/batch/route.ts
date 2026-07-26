import { and, eq, inArray } from "drizzle-orm";

import { promptFavorites } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ok, readJson, route } from "@/lib/server/http";
import { batchDeleteSchema } from "@/lib/server/validation";

export const DELETE = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, batchDeleteSchema, 64 * 1024);
  const deleted = await getDb()
    .delete(promptFavorites)
    .where(
      and(
        eq(promptFavorites.userId, current.user.id),
        inArray(promptFavorites.id, input.ids),
      ),
    )
    .returning({ id: promptFavorites.id });

  return ok({ success: true, deleted: deleted.length });
});
