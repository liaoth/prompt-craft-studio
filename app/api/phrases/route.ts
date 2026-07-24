import { asc, eq } from "drizzle-orm";

import { phraseSnippets } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { ok, readJson, route } from "@/lib/server/http";
import { phraseCreateSchema } from "@/lib/server/validation";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const items = await getDb()
    .select()
    .from(phraseSnippets)
    .where(eq(phraseSnippets.userId, current.user.id))
    .orderBy(
      asc(phraseSnippets.sortOrder),
      asc(phraseSnippets.category),
      asc(phraseSnippets.createdAt),
    );
  return ok({ items });
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, phraseCreateSchema, 16 * 1024);
  const [item] = await getDb()
    .insert(phraseSnippets)
    .values({ userId: current.user.id, ...input })
    .returning();
  return ok({ item }, { status: 201 });
});
