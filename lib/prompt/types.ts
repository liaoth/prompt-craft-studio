import { z } from "zod";

export const PROMPT_FIELD_ORDER = [
  "subject",
  "action",
  "environment",
  "composition",
  "camera",
  "lighting",
  "color",
  "material",
  "medium",
  "style",
  "mood",
  "negative",
] as const;

export const PROMPT_BLOCK_FIELD_ORDER = [...PROMPT_FIELD_ORDER, "custom"] as const;
export const PromptFieldKeySchema = z.enum(PROMPT_FIELD_ORDER);
export const PromptBlockFieldSchema = z.enum(PROMPT_BLOCK_FIELD_ORDER);
export type PromptFieldKey = z.infer<typeof PromptFieldKeySchema>;
export type PromptBlockField = z.infer<typeof PromptBlockFieldSchema>;

const promptText = z.string().trim().max(4_000);
export const PROMPT_OUTPUT_MAX_LENGTH = 48_000;
const outputText = z.string().trim().min(1).max(PROMPT_OUTPUT_MAX_LENGTH);

export const PromptFieldsSchema = z
  .object(
    Object.fromEntries(PROMPT_FIELD_ORDER.map((field) => [field, promptText.default("")])) as {
      [K in PromptFieldKey]: z.ZodDefault<typeof promptText>;
    },
  )
  .strict();
export type PromptFields = z.infer<typeof PromptFieldsSchema>;

export const TranslatedPromptFieldsSchema = z
  .object(
    Object.fromEntries(PROMPT_FIELD_ORDER.map((field) => [field, promptText.optional()])) as {
      [K in PromptFieldKey]: z.ZodOptional<typeof promptText>;
    },
  )
  .strict();
export type TranslatedPromptFields = z.infer<typeof TranslatedPromptFieldsSchema>;

export const PromptBlockOriginSchema = z.enum([
  "user",
  "idea",
  "template",
  "ai",
  "phrase",
  "legacy",
]);
export type PromptBlockOrigin = z.infer<typeof PromptBlockOriginSchema>;
export const PromptBlockEnglishModeSchema = z.enum(["auto", "manual"]);
export type PromptBlockEnglishMode = z.infer<typeof PromptBlockEnglishModeSchema>;

export const PromptBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    field: PromptBlockFieldSchema,
    order: z.number().int().min(0).max(10_000),
    textZh: promptText,
    textEn: promptText,
    textEnMode: PromptBlockEnglishModeSchema.default("auto"),
    origin: PromptBlockOriginSchema,
  })
  .strict()
  .refine((value) => Boolean(value.textZh || value.textEn), {
    message: "词块至少需要一种语言的内容。",
  });
export type PromptBlock = z.infer<typeof PromptBlockSchema>;

export const MIDJOURNEY_MODELS = [
  "8.2",
  "8.1",
  "8",
  "7",
  "6.1",
  "6",
  "niji-7",
  "niji-6",
] as const;
export const MidjourneyModelSchema = z.enum(MIDJOURNEY_MODELS);
export type MidjourneyModel = z.infer<typeof MidjourneyModelSchema>;

export const TargetSurfaceSchema = z.enum(["web", "discord"]);
export type TargetSurface = z.infer<typeof TargetSurfaceSchema>;
export const TaskTypeSchema = z.enum(["image", "video"]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const PromptParametersSchema = z
  .object({
    model: MidjourneyModelSchema.optional(),
    aspectRatio: z.string().trim().max(20).optional(),
    stylize: z.number().finite().optional(),
    chaos: z.number().finite().optional(),
    weird: z.number().finite().optional(),
    quality: z.number().finite().optional(),
    seed: z.number().finite().optional(),
    raw: z.boolean().optional(),
    tile: z.boolean().optional(),
    no: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
    /** @deprecated V2 compatibility only. Use PromptReferences.omniReference. */
    omniReference: z.string().trim().max(2_000).optional(),
    omniWeight: z.number().finite().optional(),
    profile: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    repeat: z.number().finite().optional(),
    visibility: z.enum(["public", "stealth"]).optional(),
    /** @deprecated V2 compatibility only. Use PromptReferences.styleReferences. */
    styleReference: z.array(z.string().trim().min(1).max(2_000)).max(20).optional(),
    styleWeight: z.number().finite().optional(),
    styleVersion: z.number().finite().optional(),
    draft: z.boolean().optional(),
    speedMode: z.enum(["fast", "relax", "turbo"]).optional(),
    imageWeight: z.number().finite().optional(),
    motion: z.enum(["low", "high"]).optional(),
    loop: z.boolean().optional(),
    /** @deprecated V2 compatibility only. Use PromptReferences.videoEnd. */
    end: z.string().trim().max(2_000).optional(),
    batchSize: z.number().finite().optional(),
    video: z.boolean().optional(),
    /** @deprecated V2 compatibility only. Video resolution is a Web UI setting. */
    videoQuality: z.enum(["sd", "hd"]).optional(),
    imageResolution: z.enum(["sd", "hd"]).optional(),
  })
  .strict();
export type PromptParameters = z.infer<typeof PromptParametersSchema>;

export const PromptReferenceKindSchema = z.enum([
  "image_prompt",
  "style_reference",
  "omni_reference",
  "video_start",
  "video_end",
]);
export type PromptReferenceKind = z.infer<typeof PromptReferenceKindSchema>;

export const PromptReferenceAssetSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    kind: PromptReferenceKindSchema,
    valueType: z.enum(["url", "code"]).default("url"),
    value: z.string().trim().min(1).max(2_000),
    order: z.number().int().min(0).max(10_000),
    weight: z.number().positive().max(100).optional(),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.valueType === "code") {
      if (
        asset.kind !== "style_reference" ||
        !/^(?:random|\d{1,12})$/i.test(asset.value)
      ) {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "Style Reference 代码只能是数字或 random。",
        });
      }
      return;
    }
    let url: URL;
    try {
      url = new URL(asset.value);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "请输入有效的 HTTPS 图片地址。",
      });
      return;
    }
    if (url.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "图片地址必须使用 HTTPS。",
      });
    }
    if (!/\.(?:jpe?g|png|webp|gif)$/i.test(url.pathname)) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "图片地址必须以 jpg、jpeg、png、webp 或 gif 结尾。",
      });
    }
  });
export type PromptReferenceAsset = z.infer<typeof PromptReferenceAssetSchema>;

export const PromptReferencesSchema = z
  .object({
    imagePrompts: z
      .array(
        PromptReferenceAssetSchema.refine((asset) => asset.kind === "image_prompt", {
          message: "普通图片引用类型不正确。",
        }),
      )
      .max(10)
      .default([]),
    styleReferences: z
      .array(
        PromptReferenceAssetSchema.refine((asset) => asset.kind === "style_reference", {
          message: "Style Reference 类型不正确。",
        }),
      )
      .max(10)
      .default([]),
    omniReference: PromptReferenceAssetSchema.refine(
      (asset) => asset.kind === "omni_reference" && asset.valueType === "url",
      { message: "Omni Reference 必须是 HTTPS 图片地址。" },
    )
      .nullable()
      .default(null),
    videoStart: PromptReferenceAssetSchema.refine(
      (asset) => asset.kind === "video_start" && asset.valueType === "url",
      { message: "视频起始帧必须是 HTTPS 图片地址。" },
    )
      .nullable()
      .default(null),
    videoEnd: PromptReferenceAssetSchema.refine(
      (asset) => asset.kind === "video_end" && asset.valueType === "url",
      { message: "视频结束帧必须是 HTTPS 图片地址。" },
    )
      .nullable()
      .default(null),
  })
  .strict();
export type PromptReferences = z.infer<typeof PromptReferencesSchema>;

export const PromptWarningSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    field: z.string().optional(),
    severity: z.enum(["warning", "error"]).default("warning"),
    suggestion: z.string().optional(),
    docsUrl: z.url().optional(),
  })
  .strict();
export type PromptWarning = z.infer<typeof PromptWarningSchema>;

export const PromptSourceSchema = z.enum(["rule", "ai"]);
export type PromptSource = z.infer<typeof PromptSourceSchema>;
export const PromptVariantKindSchema = z.enum(["concise", "detailed", "experimental"]);
export type PromptVariantKind = z.infer<typeof PromptVariantKindSchema>;

export const PromptVariantSchema = z
  .object({
    id: PromptVariantKindSchema,
    label: z.string().trim().min(1).max(40),
    blocks: z.array(PromptBlockSchema).max(240),
    bodyZh: outputText,
    bodyEn: outputText,
    promptZh: outputText,
    promptEn: outputText,
  })
  .strict();
export type PromptVariant = z.infer<typeof PromptVariantSchema>;

const commonPromptShape = {
  variants: z.array(PromptVariantSchema).min(1).max(3),
  selectedVariant: PromptVariantKindSchema,
  blocks: z.array(PromptBlockSchema).max(240),
  targetSurface: TargetSurfaceSchema.default("web"),
  taskType: TaskTypeSchema.default("image"),
  bodyZh: outputText,
  bodyEn: outputText,
  promptZh: outputText,
  promptEn: outputText,
  fields: PromptFieldsSchema,
  translatedFields: TranslatedPromptFieldsSchema.default({}),
  parameters: PromptParametersSchema.default({}),
  warnings: z.array(PromptWarningSchema).max(100).default([]),
  source: PromptSourceSchema,
} as const;

const v3Common = {
  schemaVersion: z.literal(3),
  ...commonPromptShape,
  references: PromptReferencesSchema.default({
    imagePrompts: [],
    styleReferences: [],
    omniReference: null,
    videoStart: null,
    videoEnd: null,
  }),
} as const;

const v4Common = {
  schemaVersion: z.literal(4),
  ...commonPromptShape,
  bilingualSyncEnabled: z.boolean().default(false),
  references: PromptReferencesSchema.default({
    imagePrompts: [],
    styleReferences: [],
    omniReference: null,
    videoStart: null,
    videoEnd: null,
  }),
} as const;

export const PromptDraftSchema = z.object(v4Common).strict().superRefine((value, context) => {
  if (!value.variants.some((variant) => variant.id === value.selectedVariant)) {
    context.addIssue({
      code: "custom",
      path: ["selectedVariant"],
      message: "所选版本不存在。",
    });
  }
});
export type PromptDraft = z.infer<typeof PromptDraftSchema>;

const LegacyPromptSnapshotSchema = z
  .object({
    input: PromptFieldsSchema,
    promptZh: outputText,
    promptEn: outputText,
    fields: PromptFieldsSchema,
    translatedFields: TranslatedPromptFieldsSchema.default({}),
    parameters: PromptParametersSchema.default({}),
    warnings: z.array(PromptWarningSchema).max(100).default([]),
    source: PromptSourceSchema,
  })
  .passthrough();

export const PromptSnapshotV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    ...commonPromptShape,
    input: PromptFieldsSchema,
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export const PromptSnapshotV3Schema = z
  .object({
    ...v3Common,
    input: PromptFieldsSchema,
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export const PromptSnapshotV4Schema = z
  .object({
    ...v4Common,
    input: PromptFieldsSchema,
    createdAt: z.string().datetime().optional(),
  })
  .strict();
export type PromptSnapshot = z.infer<typeof PromptSnapshotV4Schema>;

export const PromptSnapshotSchema = z.preprocess(
  (value) => normalizePromptSnapshot(value),
  PromptSnapshotV4Schema,
);

export function emptyPromptFields(): PromptFields {
  return PromptFieldsSchema.parse({});
}

export function normalizePromptSnapshot(input: unknown): unknown {
  const current = PromptSnapshotV4Schema.safeParse(input);
  if (current.success) return reconcileSnapshotNegatives(current.data);

  const v3 = PromptSnapshotV3Schema.safeParse(input);
  if (v3.success) return migrateV3Snapshot(v3.data);

  const v2 = PromptSnapshotV2Schema.safeParse(input);
  if (v2.success) return migrateV2Snapshot(v2.data);

  const legacy = LegacyPromptSnapshotSchema.safeParse(input);
  if (!legacy.success) return input;

  const value = legacy.data;
  const blocks = PROMPT_FIELD_ORDER.flatMap((field, order) => {
    const textZh = value.fields[field] || value.input[field] || "";
    const textEn = value.translatedFields[field] || textZh;
    if (!textZh && !textEn) return [];
    return [
      {
        id: `legacy-${field}-${order}`,
        field,
        order,
        textZh,
        textEn,
        textEnMode: "auto" as const,
        origin: "legacy" as const,
      },
    ];
  });
  const parameters = value.parameters.model === "8"
    ? { ...value.parameters, model: "8" as const }
    : value.parameters;
  const variant: PromptVariant = {
    id: "detailed",
    label: "详细",
    blocks,
    bodyZh: stripParameterSuffix(value.promptZh),
    bodyEn: stripParameterSuffix(value.promptEn),
    promptZh: value.promptZh,
    promptEn: value.promptEn,
  };
  return migrateV2Snapshot({
    schemaVersion: 2,
    input: value.input,
    variants: [variant],
    selectedVariant: "detailed",
    blocks,
    targetSurface: "web",
    taskType: "image",
    bodyZh: variant.bodyZh,
    bodyEn: variant.bodyEn,
    promptZh: value.promptZh,
    promptEn: value.promptEn,
    fields: value.fields,
    translatedFields: value.translatedFields,
    parameters,
    warnings: value.warnings,
    source: value.source,
  });
}

function migrateV2Snapshot(value: z.infer<typeof PromptSnapshotV2Schema>): PromptSnapshot {
  const {
    omniReference,
    styleReference,
    end,
    videoQuality,
    ...parameters
  } = value.parameters;
  const makeReference = (
    kind: PromptReferenceKind,
    referenceValue: string,
    order: number,
    valueType: "url" | "code" = "url",
  ): PromptReferenceAsset => ({
    id: `migrated-${kind}-${order}`,
    kind,
    valueType,
    value: referenceValue,
    order,
  });
  const styleReferences = (styleReference ?? []).map((item, order) =>
    makeReference(
      "style_reference",
      item,
      order,
      /^(?:random|\d{1,12})$/i.test(item) ? "code" : "url",
    ),
  );
  const migrationWarnings = videoQuality
    ? [
        {
          code: "MIGRATED_VIDEO_QUALITY",
          field: "videoQuality",
          message: "旧快照中的 SD/HD 视频参数已移除；视频分辨率请在 Midjourney Web 设置中选择。",
          severity: "warning" as const,
        },
      ]
    : [];
  return reconcileSnapshotNegatives(PromptSnapshotV4Schema.parse({
    ...value,
    schemaVersion: 4,
    bilingualSyncEnabled:
      value.source === "ai" ||
      value.blocks.some((block) => block.origin === "idea"),
    parameters:
      videoQuality && value.taskType === "image"
        ? { ...parameters, imageResolution: videoQuality }
        : parameters,
    references: {
      imagePrompts: [],
      styleReferences,
      omniReference: omniReference
        ? makeReference("omni_reference", omniReference, 0)
        : null,
      videoStart: null,
      videoEnd: end ? makeReference("video_end", end, 0) : null,
    },
    warnings: [...value.warnings, ...migrationWarnings],
  }));
}

function migrateV3Snapshot(
  value: z.infer<typeof PromptSnapshotV3Schema>,
): PromptSnapshot {
  return reconcileSnapshotNegatives(PromptSnapshotV4Schema.parse({
    ...value,
    schemaVersion: 4,
    bilingualSyncEnabled:
      value.source === "ai" ||
      value.blocks.some((block) => block.origin === "idea"),
  }));
}

function reconcileSnapshotNegatives(value: PromptSnapshot): PromptSnapshot {
  const topBlocks = mergeLegacyNegativeValues(value.blocks, value.parameters.no ?? []);
  const normalizedNo = snapshotNegativeValues(topBlocks);
  const variants = value.variants.map((variant) => {
    const hasOwnNegative = variant.blocks.some((block) => block.field === "negative");
    return {
      ...variant,
      blocks: hasOwnNegative
        ? mergeLegacyNegativeValues(variant.blocks, [])
        : mergeLegacyNegativeValues(variant.blocks, normalizedNo),
    };
  });
  const parameters = { ...value.parameters };
  delete parameters.no;
  return {
    ...value,
    blocks: topBlocks,
    variants,
    parameters: normalizedNo.length ? { ...parameters, no: normalizedNo } : parameters,
  };
}

function mergeLegacyNegativeValues(
  blocks: PromptBlock[],
  values: readonly string[],
): PromptBlock[] {
  const existing = blocks.filter((block) => block.field === "negative");
  const seen = new Set(
    existing
      .map((block) => snapshotTextKey(block.textEn || block.textZh))
      .filter(Boolean),
  );
  const additions: PromptBlock[] = [];
  for (const raw of values) {
    const textEn = raw.trim().replace(/\s+/g, " ");
    const key = snapshotTextKey(textEn);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    additions.push({
      id: `legacy-negative-${existing.length + additions.length}-${stableTextId(key)}`,
      field: "negative",
      order: existing.length + additions.length,
      textZh: "",
      textEn,
      textEnMode: "auto",
      origin: "legacy",
    });
  }
  const counters = new Map<PromptBlockField, number>();
  return [...blocks, ...additions].map((block) => {
    const order = counters.get(block.field) ?? 0;
    counters.set(block.field, order + 1);
    return { ...block, order };
  });
}

function snapshotNegativeValues(blocks: readonly PromptBlock[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const block of blocks
    .filter((item) => item.field === "negative")
    .sort((left, right) => left.order - right.order)) {
    const value = (block.textEn || block.textZh).trim().replace(/\s+/g, " ");
    const key = snapshotTextKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values;
}

function snapshotTextKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function stableTextId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stripParameterSuffix(value: string): string {
  const index = value.search(/\s--[a-z]/i);
  return (index >= 0 ? value.slice(0, index) : value).trim();
}
