import { and, eq } from "drizzle-orm";

import { promptFavorites, promptFolders } from "@/db/schema";
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
    .where(and(eq(promptFavorites.id, id), eq(promptFavorites.userId, current.user.id)))
    .limit(1);
  if (!item) throw new ApiError(404, "作品不存在。", "NOT_FOUND");
  return ok({ item });
});

export const PATCH = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const input = await readJson(request, favoriteUpdateSchema, 16 * 1024);
  const db = getDb();
  if (input.folderId) {
    const [folder] = await db
      .select({ id: promptFolders.id })
      .from(promptFolders)
      .where(
        and(eq(promptFolders.id, input.folderId), eq(promptFolders.userId, current.user.id)),
      )
      .limit(1);
    if (!folder) throw new ApiError(404, "文件夹不存在。", "FOLDER_NOT_FOUND");
  }
  const [item] = await db
    .update(promptFavorites)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(promptFavorites.id, id), eq(promptFavorites.userId, current.user.id)))
    .returning();
  if (!item) throw new ApiError(404, "作品不存在。", "NOT_FOUND");
  return ok({ item });
});

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(promptFavorites)
    .where(and(eq(promptFavorites.id, id), eq(promptFavorites.userId, current.user.id)))
    .returning({ id: promptFavorites.id });
  if (!deleted) throw new ApiError(404, "作品不存在。", "NOT_FOUND");
  return ok({ success: true });
});
