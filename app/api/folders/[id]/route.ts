import { and, eq } from "drizzle-orm";

import { promptFolders } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { folderUpdateSchema, idSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const input = await readJson(request, folderUpdateSchema, 8 * 1024);
  const db = getDb();
  if (input.name) {
    const [duplicate] = await db
      .select({ id: promptFolders.id })
      .from(promptFolders)
      .where(
        and(
          eq(promptFolders.userId, current.user.id),
          eq(promptFolders.name, input.name),
        ),
      )
      .limit(1);
    if (duplicate && duplicate.id !== id) {
      throw new ApiError(409, "同名文件夹已存在。", "FOLDER_NAME_CONFLICT");
    }
  }
  const [item] = await db
    .update(promptFolders)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(promptFolders.id, id), eq(promptFolders.userId, current.user.id)))
    .returning();
  if (!item) throw new ApiError(404, "文件夹不存在。", "NOT_FOUND");
  return ok({ item });
});

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(promptFolders)
    .where(and(eq(promptFolders.id, id), eq(promptFolders.userId, current.user.id)))
    .returning({ id: promptFolders.id });
  if (!deleted) throw new ApiError(404, "文件夹不存在。", "NOT_FOUND");
  // The foreign key uses ON DELETE SET NULL, so works are preserved as unfiled.
  return ok({ success: true, movedToUnfiled: true });
});
