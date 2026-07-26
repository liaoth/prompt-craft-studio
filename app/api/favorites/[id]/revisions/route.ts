import { and, desc, eq, ne } from "drizzle-orm";

import { promptFavoriteRevisions, promptFavorites } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { PromptSnapshot } from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import { promptContentHash } from "@/lib/server/history";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { favoriteRevisionCreateSchema, idSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const favoriteId = idSchema.parse(rawId);
  const [favorite] = await getDb()
    .select()
    .from(promptFavorites)
    .where(
      and(
        eq(promptFavorites.id, favoriteId),
        eq(promptFavorites.userId, current.user.id),
      ),
    )
    .limit(1);
  if (!favorite) throw new ApiError(404, "作品不存在。", "NOT_FOUND");
  const revisions = await getDb()
    .select()
    .from(promptFavoriteRevisions)
    .where(
      and(
        eq(promptFavoriteRevisions.favoriteId, favoriteId),
        eq(promptFavoriteRevisions.userId, current.user.id),
      ),
    )
    .orderBy(desc(promptFavoriteRevisions.revisionNo));
  return ok({ favorite, revisions });
});

export const POST = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const favoriteId = idSchema.parse(rawId);
  const input = await readJson(request, favoriteRevisionCreateSchema, 512 * 1024);
  const snapshot = input.snapshot as PromptSnapshot;
  const contentHash = promptContentHash(snapshot);
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [favorite] = await tx
      .select()
      .from(promptFavorites)
      .where(
        and(
          eq(promptFavorites.id, favoriteId),
          eq(promptFavorites.userId, current.user.id),
        ),
      )
      .limit(1);
    if (!favorite) throw new ApiError(404, "作品不存在。", "NOT_FOUND");
    if (favorite.contentHash === contentHash) {
      throw new ApiError(409, "Prompt 内容没有变化。", "NO_CONTENT_CHANGE");
    }
    const [conflict] = await tx
      .select({ id: promptFavorites.id, title: promptFavorites.title })
      .from(promptFavorites)
      .where(
        and(
          eq(promptFavorites.userId, current.user.id),
          eq(promptFavorites.contentHash, contentHash),
          ne(promptFavorites.id, favoriteId),
        ),
      )
      .limit(1);
    if (conflict) {
      throw new ApiError(
        409,
        `该 Prompt 已属于作品“${conflict.title}”，不能静默合并修订。`,
        "REVISION_CONFLICT",
      );
    }
    const [latest] = await tx
      .select({ revisionNo: promptFavoriteRevisions.revisionNo })
      .from(promptFavoriteRevisions)
      .where(eq(promptFavoriteRevisions.favoriteId, favoriteId))
      .orderBy(desc(promptFavoriteRevisions.revisionNo))
      .limit(1);
    const revisionNo = (latest?.revisionNo ?? 0) + 1;
    const [revision] = await tx
      .insert(promptFavoriteRevisions)
      .values({
        userId: current.user.id,
        favoriteId,
        revisionNo,
        contentHash,
        promptZh: snapshot.promptZh,
        promptEn: snapshot.promptEn,
        snapshot,
      })
      .returning();
    const [updated] = await tx
      .update(promptFavorites)
      .set({
        contentHash,
        promptZh: snapshot.promptZh,
        promptEn: snapshot.promptEn,
        source: snapshot.source,
        snapshot,
        updatedAt: new Date(),
      })
      .where(eq(promptFavorites.id, favoriteId))
      .returning();
    return { revision, favorite: updated };
  });
  return ok(result, { status: 201 });
});
