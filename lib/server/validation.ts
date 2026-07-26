import { z } from "zod";
import {
  PromptSnapshotSchema,
  PromptWarningSchema,
  type PromptSource,
} from "@/lib/prompt";

export const idSchema = z.uuid();

export const batchDeleteSchema = z
  .object({
    ids: z.array(idSchema).min(1).max(500),
  })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length, {
    path: ["ids"],
    message: "删除列表中不能包含重复记录。",
  });

export const phraseCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(50).default("未分类"),
  content: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
});

export const phraseUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(50).optional(),
    content: z.string().trim().min(1).max(500).optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个需要修改的字段。",
  });

export const promptSnapshotSchema = PromptSnapshotSchema;

export const favoriteCreateSchema = z.object({
  snapshot: promptSnapshotSchema,
  title: z.string().trim().min(1).max(160).optional(),
  folderId: idSchema.nullable().optional(),
  note: z.string().trim().max(1000).default(""),
});

export const favoriteUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    folderId: idSchema.nullable().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个需要修改的字段。",
  });

export const favoriteRevisionCreateSchema = z.object({
  snapshot: promptSnapshotSchema,
});

export const folderCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(-100_000).max(100_000).default(0),
});

export const folderUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个需要修改的字段。",
  });

export const exportRequestSchema = z
  .object({
    format: z.enum(["txt", "markdown", "json"]),
    scope: z.enum(["current", "favorite", "selected", "folder"]),
    snapshot: promptSnapshotSchema.optional(),
    favoriteId: idSchema.optional(),
    favoriteIds: z.array(idSchema).min(1).max(500).optional(),
    folderId: idSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.scope === "current" && !value.snapshot) {
      context.addIssue({ code: "custom", path: ["snapshot"], message: "缺少当前 Prompt。" });
    }
    if (value.scope === "favorite" && !value.favoriteId) {
      context.addIssue({ code: "custom", path: ["favoriteId"], message: "缺少作品 ID。" });
    }
    if (value.scope === "selected" && !value.favoriteIds?.length) {
      context.addIssue({ code: "custom", path: ["favoriteIds"], message: "请选择作品。" });
    }
    if (value.scope === "folder" && !value.folderId) {
      context.addIssue({ code: "custom", path: ["folderId"], message: "缺少文件夹 ID。" });
    }
  });

export const midjourneySubmitSchema = z
  .object({
    promptZh: z.string().trim().max(48_000).default(""),
    promptEn: z.string().trim().max(48_000).default(""),
    source: z
      .custom<PromptSource>((value) => value === "rule" || value === "ai")
      .default("rule"),
    snapshot: z
      .object({
        promptZh: z.string().trim().max(48_000).optional(),
        promptEn: z.string().trim().max(48_000).optional(),
        source: z
          .custom<PromptSource>((value) => value === "rule" || value === "ai")
          .optional(),
        fields: z.record(z.string(), z.unknown()).optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        warnings: z.array(PromptWarningSchema).max(100).optional(),
      })
      .passthrough()
      .optional(),
  })
  .superRefine((value, context) => {
    if (!value.promptZh.trim() && !value.promptEn.trim()) {
      context.addIssue({
        code: "custom",
        message: "至少生成中文或英文 Prompt 后才可推送。",
        path: ["promptZh"],
      });
    }
  });
