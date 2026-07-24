import { and, eq } from "drizzle-orm";

import { promptFavorites } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { favoriteUpdateSchema, idSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [item] = await getDb()
    .select()
    .from(promptFavorites)
    .where(
      and(
        eq(promptFavorites.id, id),
        eq(promptFavorites.userId, current.user.id),
      ),
    )
    .limit(1);
  if (!item) throw new ApiError(404, "收藏不存在。", "NOT_FOUND");
  return ok({ item });
});

export const PATCH = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const input = await readJson(request, favoriteUpdateSchema, 8 * 1024);
  const [item] = await getDb()
    .update(promptFavorites)
    .set({ note: input.note })
    .where(
      and(
        eq(promptFavorites.id, id),
        eq(promptFavorites.userId, current.user.id),
      ),
    )
    .returning();
  if (!item) throw new ApiError(404, "收藏不存在。", "NOT_FOUND");
  return ok({ item });
});

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(promptFavorites)
    .where(
      and(
        eq(promptFavorites.id, id),
        eq(promptFavorites.userId, current.user.id),
      ),
    )
    .returning({ id: promptFavorites.id });
  if (!deleted) throw new ApiError(404, "收藏不存在。", "NOT_FOUND");
  return ok({ success: true });
});
