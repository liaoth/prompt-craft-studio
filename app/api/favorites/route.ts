import { and, count, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";

import {
  promptFavoriteRevisions,
  promptFavorites,
  promptFolders,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import type { PromptSnapshot } from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import { promptContentHash } from "@/lib/server/history";
import { ApiError, ok, pagination, readJson, route } from "@/lib/server/http";
import { favoriteCreateSchema, idSchema } from "@/lib/server/validation";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const { page, limit, offset } = pagination(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim().slice(0, 160);
  const folder = url.searchParams.get("folder");
  const conditions = [eq(promptFavorites.userId, current.user.id)];
  if (search) conditions.push(ilike(promptFavorites.title, `%${search}%`));
  if (folder === "unfiled") conditions.push(isNull(promptFavorites.folderId));
  else if (folder) conditions.push(eq(promptFavorites.folderId, idSchema.parse(folder)));
  const where = and(...conditions);
  const db = getDb();
  const [items, [summary]] = await Promise.all([
    db
      .select()
      .from(promptFavorites)
      .where(where)
      .orderBy(desc(promptFavorites.updatedAt), desc(promptFavorites.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(promptFavorites).where(where),
  ]);
  const counts = items.length
    ? await db
        .select({
          favoriteId: promptFavoriteRevisions.favoriteId,
          revisionCount: count(),
        })
        .from(promptFavoriteRevisions)
        .where(
          and(
            eq(promptFavoriteRevisions.userId, current.user.id),
            inArray(
              promptFavoriteRevisions.favoriteId,
              items.map((item) => item.id),
            ),
          ),
        )
        .groupBy(promptFavoriteRevisions.favoriteId)
    : [];
  const countById = new Map(counts.map((item) => [item.favoriteId, Number(item.revisionCount)]));
  const total = Number(summary?.total ?? 0);
  return ok({
    items: items.map((item) => ({ ...item, revisionCount: countById.get(item.id) ?? 0 })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, favoriteCreateSchema, 512 * 1024);
  const snapshot = input.snapshot as PromptSnapshot;
  const contentHash = promptContentHash(snapshot);
  const db = getDb();
  const item = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`favorite:${current.user.id}`}, 0))`,
    );
    if (input.folderId) {
      const [folder] = await tx
        .select({ id: promptFolders.id })
        .from(promptFolders)
        .where(
          and(
            eq(promptFolders.id, input.folderId),
            eq(promptFolders.userId, current.user.id),
          ),
        )
        .limit(1);
      if (!folder) throw new ApiError(404, "文件夹不存在。", "FOLDER_NOT_FOUND");
    }
    const [existing] = await tx
      .select()
      .from(promptFavorites)
      .where(
        and(
          eq(promptFavorites.userId, current.user.id),
          eq(promptFavorites.contentHash, contentHash),
        ),
      )
      .limit(1);
    if (existing) {
      const [updated] = await tx
        .update(promptFavorites)
        .set({
          title: input.title ?? existing.title,
          folderId: input.folderId === undefined ? existing.folderId : input.folderId,
          note: input.note,
          updatedAt: new Date(),
        })
        .where(eq(promptFavorites.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(promptFavorites)
      .values({
        userId: current.user.id,
        contentHash,
        promptZh: snapshot.promptZh,
        promptEn: snapshot.promptEn,
        source: snapshot.source,
        snapshot,
        title: input.title ?? automaticTitle(snapshot),
        folderId: input.folderId,
        note: input.note,
      })
      .returning();
    await tx.insert(promptFavoriteRevisions).values({
      userId: current.user.id,
      favoriteId: created.id,
      revisionNo: 1,
      contentHash,
      promptZh: snapshot.promptZh,
      promptEn: snapshot.promptEn,
      snapshot,
    });
    return created;
  });
  return ok({ item }, { status: 201 });
});

function automaticTitle(snapshot: PromptSnapshot): string {
  const source = snapshot.bodyZh || snapshot.promptZh || snapshot.bodyEn || snapshot.promptEn;
  const title = source.replace(/\s--[a-z].*$/i, "").trim().slice(0, 60);
  return title || "未命名作品";
}
