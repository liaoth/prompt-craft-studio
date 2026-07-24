import { and, eq } from "drizzle-orm";

import { promptHistories } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ApiError, ok, route } from "@/lib/server/http";
import { idSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [item] = await getDb()
    .select()
    .from(promptHistories)
    .where(
      and(
        eq(promptHistories.id, id),
        eq(promptHistories.userId, current.user.id),
      ),
    )
    .limit(1);
  if (!item) throw new ApiError(404, "历史记录不存在。", "NOT_FOUND");
  return ok({ item });
});

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(promptHistories)
    .where(
      and(
        eq(promptHistories.id, id),
        eq(promptHistories.userId, current.user.id),
      ),
    )
    .returning({ id: promptHistories.id });
  if (!deleted) throw new ApiError(404, "历史记录不存在。", "NOT_FOUND");
  return ok({ success: true });
});
