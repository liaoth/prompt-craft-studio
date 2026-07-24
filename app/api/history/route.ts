import { count, desc, eq } from "drizzle-orm";

import { promptHistories } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ok, pagination, route } from "@/lib/server/http";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const { page, limit, offset } = pagination(request);
  const db = getDb();
  const [items, [summary]] = await Promise.all([
    db
      .select()
      .from(promptHistories)
      .where(eq(promptHistories.userId, current.user.id))
      .orderBy(desc(promptHistories.updatedAt), desc(promptHistories.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(promptHistories)
      .where(eq(promptHistories.userId, current.user.id)),
  ]);
  const total = Number(summary?.total ?? 0);
  return ok({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const DELETE = route(async (request) => {
  const current = await requireSession(request);
  const deleted = await getDb()
    .delete(promptHistories)
    .where(eq(promptHistories.userId, current.user.id))
    .returning({ id: promptHistories.id });
  return ok({ success: true, deleted: deleted.length });
});
