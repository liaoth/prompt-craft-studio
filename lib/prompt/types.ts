import { z } from "zod";

export const PROMPT_FIELD_ORDER = [
  "subject",
  "action",
  "environment",
  "medium",
  "style",
  "composition",
  "camera",
  "lighting",
  "color",
  "material",
  "mood",
  "negative",
] as const;

export const PromptFieldKeySchema = z.enum(PROMPT_FIELD_ORDER);
export type PromptFieldKey = z.infer<typeof PromptFieldKeySchema>;

const promptText = z.string().trim().max(4_000);
export const PROMPT_OUTPUT_MAX_LENGTH = 48_000;
const outputText = z.string().trim().min(1).max(PROMPT_OUTPUT_MAX_LENGTH);

export const PromptFieldsSchema = z
  .object({
    subject: promptText.default(""),
    action: promptText.default(""),
    environment: promptText.default(""),
    medium: promptText.default(""),
    style: promptText.default(""),
    composition: promptText.default(""),
    camera: promptText.default(""),
    lighting: promptText.default(""),
    color: promptText.default(""),
    material: promptText.default(""),
    mood: promptText.default(""),
    negative: promptText.default(""),
  })
  .strict();

export type PromptFields = z.infer<typeof PromptFieldsSchema>;

export const TranslatedPromptFieldsSchema = z
  .object({
    subject: promptText.optional(),
    action: promptText.optional(),
    environment: promptText.optional(),
    medium: promptText.optional(),
    style: promptText.optional(),
    composition: promptText.optional(),
    camera: promptText.optional(),
    lighting: promptText.optional(),
    color: promptText.optional(),
    material: promptText.optional(),
    mood: promptText.optional(),
    negative: promptText.optional(),
  })
  .strict();

export const MIDJOURNEY_MODELS = [
  "8.1",
  "8",
  "7",
  "6.1",
  "6",
  "niji-7",
  "niji-6",
] as const;

export const PromptParametersSchema = z
  .object({
    model: z.enum(MIDJOURNEY_MODELS).optional(),
    aspectRatio: z.string().trim().max(20).optional(),
    stylize: z.number().finite().optional(),
    chaos: z.number().finite().optional(),
    weird: z.number().finite().optional(),
    quality: z.number().finite().optional(),
    seed: z.number().finite().optional(),
    raw: z.boolean().optional(),
    tile: z.boolean().optional(),
    no: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
  })
  .strict();

export type PromptParameters = z.infer<typeof PromptParametersSchema>;

export const PromptWarningSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    field: z.string().optional(),
    severity: z.enum(["warning", "error"]).default("warning"),
  })
  .strict();

export type PromptWarning = z.infer<typeof PromptWarningSchema>;

export const PromptSourceSchema = z.enum(["rule", "ai"]);
export type PromptSource = z.infer<typeof PromptSourceSchema>;

export const PromptDraftSchema = z
  .object({
    promptZh: outputText,
    promptEn: outputText,
    fields: PromptFieldsSchema,
    translatedFields: TranslatedPromptFieldsSchema.default({}),
    parameters: PromptParametersSchema.default({}),
    warnings: z.array(PromptWarningSchema).max(30).default([]),
    source: PromptSourceSchema,
  })
  .strict();

export type PromptDraft = z.infer<typeof PromptDraftSchema>;

export const PromptSnapshotSchema = z
  .object({
    input: PromptFieldsSchema,
    promptZh: outputText,
    promptEn: outputText,
    fields: PromptFieldsSchema,
    translatedFields: TranslatedPromptFieldsSchema,
    parameters: PromptParametersSchema,
    warnings: z.array(PromptWarningSchema).max(30).default([]),
    source: PromptSourceSchema,
  })
  .strict();

export type PromptSnapshot = z.infer<typeof PromptSnapshotSchema>;

export function emptyPromptFields(): PromptFields {
  return PromptFieldsSchema.parse({});
}
