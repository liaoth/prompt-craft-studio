import { and, eq, inArray } from "drizzle-orm";

import { promptFavorites, promptFolders } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  PromptSnapshotSchema,
  type PromptSnapshot,
} from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import { ApiError, readJson, route } from "@/lib/server/http";
import { exportRequestSchema } from "@/lib/server/validation";

type ExportItem = {
  title: string;
  note?: string;
  snapshot: PromptSnapshot;
  updatedAt?: Date;
};

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, exportRequestSchema, 768 * 1024);
  const db = getDb();
  let items: ExportItem[] = [];
  let name = "midjourney-prompts";

  if (input.scope === "current") {
    items = [{ title: "当前 Prompt", snapshot: input.snapshot! }];
    name = "current-prompt";
  } else {
    const conditions = [eq(promptFavorites.userId, current.user.id)];
    if (input.scope === "favorite") {
      conditions.push(eq(promptFavorites.id, input.favoriteId!));
    } else if (input.scope === "selected") {
      conditions.push(inArray(promptFavorites.id, input.favoriteIds!));
    } else {
      const [folder] = await db
        .select({ name: promptFolders.name })
        .from(promptFolders)
        .where(
          and(
            eq(promptFolders.id, input.folderId!),
            eq(promptFolders.userId, current.user.id),
          ),
        )
        .limit(1);
      if (!folder) throw new ApiError(404, "文件夹不存在。", "FOLDER_NOT_FOUND");
      name = safeName(folder.name);
      conditions.push(eq(promptFavorites.folderId, input.folderId!));
    }
    const rows = await db
      .select()
      .from(promptFavorites)
      .where(and(...conditions))
      .limit(500);
    items = rows.map((row) => ({
      title: row.title,
      note: row.note,
      snapshot: PromptSnapshotSchema.parse(row.snapshot),
      updatedAt: row.updatedAt,
    }));
  }
  if (!items.length) throw new ApiError(404, "没有可导出的作品。", "NOT_FOUND");

  const output = serializeExport(items, input.format);
  const extension = input.format === "markdown" ? "md" : input.format;
  const contentType =
    input.format === "json"
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8";
  return new Response(`\uFEFF${output}`, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeName(name)}.${extension}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export function serializeExport(
  items: readonly ExportItem[],
  format: "txt" | "markdown" | "json",
): string {
  if (format === "json") {
    return JSON.stringify(
      {
        schemaVersion: 4,
        exportedAt: new Date().toISOString(),
        items: items.map((item) => ({
          title: item.title,
          note: item.note ?? "",
          updatedAt: item.updatedAt?.toISOString(),
          snapshot: item.snapshot,
        })),
      },
      null,
      2,
    );
  }
  const sections = items.map((item) => {
    const snapshot = item.snapshot;
    if (format === "markdown") {
      return [
        `## ${item.title}`,
        item.note ? `> ${item.note}` : "",
        "### 中文正文",
        snapshot.bodyZh,
        "### 英文正文",
        snapshot.bodyEn,
        "### 完整 Prompt",
        "```text",
        snapshot.promptEn,
        "```",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    return [
      `标题：${item.title}`,
      item.note ? `备注：${item.note}` : "",
      `中文正文：${snapshot.bodyZh}`,
      `英文正文：${snapshot.bodyEn}`,
      `完整 Prompt：${snapshot.promptEn}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return sections.join("\n\n---\n\n");
}

function safeName(value: string): string {
  return (
    value
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "midjourney-prompts"
  );
}
