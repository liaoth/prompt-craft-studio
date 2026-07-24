import { and, eq } from "drizzle-orm";

import { phraseSnippets } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { idSchema, phraseUpdateSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = route<RouteContext>(
  async (request, context) => {
    const current = await requireSession(request);
    const { id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    const input = await readJson(request, phraseUpdateSchema, 16 * 1024);
    const [item] = await getDb()
      .update(phraseSnippets)
      .set(input)
      .where(
        and(
          eq(phraseSnippets.id, id),
          eq(phraseSnippets.userId, current.user.id),
        ),
      )
      .returning();
    if (!item) throw new ApiError(404, "常用词不存在。", "NOT_FOUND");
    return ok({ item });
  },
);

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(phraseSnippets)
    .where(
      and(
        eq(phraseSnippets.id, id),
        eq(phraseSnippets.userId, current.user.id),
      ),
    )
    .returning({ id: phraseSnippets.id });
  if (!deleted) throw new ApiError(404, "常用词不存在。", "NOT_FOUND");
  return ok({ success: true });
});
