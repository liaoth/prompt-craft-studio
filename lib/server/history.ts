import { createHash } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import { promptHistories } from "@/db/schema";
import { getDb } from "@/lib/db";
import { PromptWarning } from "@/lib/prompt";

export const HISTORY_LIMIT = 100;

export type StoredPromptSnapshot = {
  promptZh: string;
  promptEn: string;
  source: "rule" | "ai";
  fields?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  warnings?: PromptWarning[];
  [key: string]: unknown;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function promptContentHash(snapshot: StoredPromptSnapshot): string {
  const content = Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => key !== "createdAt" && key !== "warnings"),
  );
  const identity = {
    schemaVersion: snapshot.schemaVersion ?? 1,
    ...content,
  };
  return createHash("sha256")
    .update(JSON.stringify(stableValue(identity)))
    .digest("hex");
}

export function historyIdsToPrune(
  entries: ReadonlyArray<{ id: string; updatedAt: Date | string }>,
  limit = HISTORY_LIMIT,
): string[] {
  if (entries.length <= limit) return [];
  return [...entries]
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime() ||
        right.id.localeCompare(left.id),
    )
    .slice(limit)
    .map((entry) => entry.id);
}

export async function savePromptHistory(
  userId: string,
  snapshot: StoredPromptSnapshot,
) {
  const contentHash = promptContentHash(snapshot);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(promptHistories)
      .values({
        userId,
        contentHash,
        promptZh: snapshot.promptZh,
        promptEn: snapshot.promptEn,
        source: snapshot.source,
        snapshot,
      })
      .onConflictDoUpdate({
        target: [promptHistories.userId, promptHistories.contentHash],
        set: {
          promptZh: snapshot.promptZh,
          promptEn: snapshot.promptEn,
          source: snapshot.source,
          snapshot,
          updatedAt: new Date(),
        },
      })
      .returning();

    const overflow = await tx
      .select({ id: promptHistories.id })
      .from(promptHistories)
      .where(eq(promptHistories.userId, userId))
      .orderBy(desc(promptHistories.updatedAt), desc(promptHistories.id))
      // SQLite requires LIMIT when OFFSET is present. A very large limit
      // preserves the “all remaining rows” semantics used by this prune query.
      .limit(2_147_483_647)
      .offset(HISTORY_LIMIT);

    if (overflow.length) {
      await tx
        .delete(promptHistories)
        .where(
          and(
            eq(promptHistories.userId, userId),
            inArray(
              promptHistories.id,
              overflow.map((item) => item.id),
            ),
          ),
        );
    }

    return saved;
  });
}
