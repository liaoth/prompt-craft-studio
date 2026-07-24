import { count, desc, eq } from "drizzle-orm";

import { promptFavorites } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { promptContentHash } from "@/lib/server/history";
import { ok, pagination, readJson, route } from "@/lib/server/http";
import { favoriteCreateSchema } from "@/lib/server/validation";
import type { PromptSnapshot } from "@/lib/prompt";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const { page, limit, offset } = pagination(request);
  const db = getDb();
  const [items, [summary]] = await Promise.all([
    db
      .select()
      .from(promptFavorites)
      .where(eq(promptFavorites.userId, current.user.id))
      .orderBy(desc(promptFavorites.updatedAt), desc(promptFavorites.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(promptFavorites)
      .where(eq(promptFavorites.userId, current.user.id)),
  ]);
  const total = Number(summary?.total ?? 0);
  return ok({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, favoriteCreateSchema, 128 * 1024);
  const snapshot = input.snapshot as PromptSnapshot;
  const contentHash = promptContentHash(snapshot);
  const [item] = await getDb()
    .insert(promptFavorites)
    .values({
      userId: current.user.id,
      contentHash,
      promptZh: snapshot.promptZh,
      promptEn: snapshot.promptEn,
      source: snapshot.source,
      snapshot,
      note: input.note,
    })
    .onConflictDoUpdate({
      target: [promptFavorites.userId, promptFavorites.contentHash],
      set: {
        promptZh: snapshot.promptZh,
        promptEn: snapshot.promptEn,
        source: snapshot.source,
        snapshot,
        note: input.note,
        updatedAt: new Date(),
      },
    })
    .returning();
  return ok({ item }, { status: 201 });
});
