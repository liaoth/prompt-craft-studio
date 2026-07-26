import { and, asc, count, eq, sql } from "drizzle-orm";

import { promptFavorites, promptFolders } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { folderCreateSchema } from "@/lib/server/validation";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const items = await getDb()
    .select({
      id: promptFolders.id,
      name: promptFolders.name,
      sortOrder: promptFolders.sortOrder,
      createdAt: promptFolders.createdAt,
      updatedAt: promptFolders.updatedAt,
      itemCount: sql<number>`(
        select count(*)::int from ${promptFavorites}
        where ${promptFavorites.folderId} = ${promptFolders.id}
          and ${promptFavorites.userId} = ${current.user.id}
      )`,
    })
    .from(promptFolders)
    .where(eq(promptFolders.userId, current.user.id))
    .orderBy(asc(promptFolders.sortOrder), asc(promptFolders.name));
  const [unfiled] = await getDb()
    .select({ total: count() })
    .from(promptFavorites)
    .where(
      and(
        eq(promptFavorites.userId, current.user.id),
        sql`${promptFavorites.folderId} is null`,
      ),
    );
  return ok({ items, unfiledCount: Number(unfiled?.total ?? 0) });
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, folderCreateSchema, 8 * 1024);
  const db = getDb();
  const [existing] = await db
    .select({ id: promptFolders.id })
    .from(promptFolders)
    .where(
      and(eq(promptFolders.userId, current.user.id), eq(promptFolders.name, input.name)),
    )
    .limit(1);
  if (existing) throw new ApiError(409, "同名文件夹已存在。", "FOLDER_NAME_CONFLICT");
  const [item] = await db
    .insert(promptFolders)
    .values({ userId: current.user.id, ...input })
    .returning();
  return ok({ item }, { status: 201 });
});
