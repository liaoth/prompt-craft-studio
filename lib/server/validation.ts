import { z } from "zod";
import {
  PromptSnapshotSchema,
  type PromptSource,
  PromptWarningSchema,
} from "@/lib/prompt";

export const idSchema = z.uuid();

export const phraseCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(50).default("未分类"),
  content: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().min(-100_000).max(100_000).default(0),
});

export const phraseUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(50).optional(),
    content: z.string().trim().min(1).max(500).optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个需要修改的字段。",
  });

export const promptSnapshotSchema = PromptSnapshotSchema;

export const favoriteCreateSchema = z.object({
  snapshot: promptSnapshotSchema,
  note: z.string().trim().max(1000).default(""),
});

export const favoriteUpdateSchema = z.object({
  note: z.string().trim().max(1000),
});

export const midjourneySubmitSchema = z
  .object({
    promptZh: z.string().trim().max(48_000).default(""),
    promptEn: z.string().trim().max(48_000).default(""),
    source: z.custom<PromptSource>((value) => value === "rule" || value === "ai").default("rule"),
    snapshot: z
      .object({
        promptZh: z.string().trim().max(48_000).optional(),
        promptEn: z.string().trim().max(48_000).optional(),
        source: z.custom<PromptSource>((value) => value === "rule" || value === "ai").optional(),
        fields: z.record(z.string(), z.unknown()).optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        warnings: z.array(PromptWarningSchema).max(30).optional(),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    if (!value.promptZh.trim() && !value.promptEn.trim()) {
      context.addIssue({
        code: "custom",
        message: "至少生成了中文或英文提示词后才可提交",
        path: ["promptZh"],
      });
    }
  });
