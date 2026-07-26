import {
  blocksToFields,
  composePromptBodies,
  createPromptBlock,
  fieldsToBlocks,
  normalizeBlockOrder,
  parametersWithNegativeBlocks,
  reconcileNegativeBlocks,
} from "./blocks";
import { composePromptWithReferences, validatePromptConfiguration } from "./references";
import { resolvePresetFields } from "./presets";
import {
  PromptBlockSchema,
  PromptFieldsSchema,
  TranslatedPromptFieldsSchema,
  type PromptBlock,
  type PromptDraft,
  type PromptFieldKey,
  type PromptFields,
  type PromptParameters,
  type PromptReferences,
  type PromptWarning,
  type TargetSurface,
  type TaskType,
} from "./types";

export interface GenerateRulePromptInput {
  idea?: string;
  translatedIdea?: string;
  blocks?: PromptBlock[];
  fields?: Partial<PromptFields>;
  translatedFields?: Partial<PromptFields>;
  presetIds?: readonly string[];
  parameters?: PromptParameters;
  custom?: string;
  translatedCustom?: string;
  targetSurface?: TargetSurface;
  taskType?: TaskType;
  references?: PromptReferences;
}

export function generateRulePrompt(input: GenerateRulePromptInput): PromptDraft {
  const targetSurface = input.targetSurface ?? "web";
  const taskType = input.taskType ?? "image";
  const fields = PromptFieldsSchema.parse(input.fields ?? {});
  const translatedFields = TranslatedPromptFieldsSchema.parse(input.translatedFields ?? {});
  const presets = resolvePresetFields(input.presetIds ?? []);
  let blocks = input.blocks?.map((block) => PromptBlockSchema.parse(block)) ??
    fieldsToBlocks(fields, translatedFields);

  if (input.presetIds?.length) {
    blocks = [
      ...blocks,
      ...fieldsToBlocks(presets.fieldsZh, presets.fieldsEn, "template"),
    ];
  }
  if (input.custom?.trim()) {
    blocks.push(
      createPromptBlock(
        "custom",
        input.custom,
        input.translatedCustom || input.custom,
        "user",
      ),
    );
  }

  const idea = input.idea?.trim() ?? "";
  if (idea && !blocks.some((block) => block.textZh === idea || block.textEn === idea)) {
    const field = blocks.some((block) => block.field === "subject") ? "custom" : "subject";
    blocks.push(
      createPromptBlock(field, idea, input.translatedIdea?.trim() || idea, "idea"),
    );
  }
  const reconciled = reconcileNegativeBlocks(
    normalizeBlockOrder(blocks),
    input.parameters ?? {},
  );
  blocks = reconciled.blocks;

  const warnings: PromptWarning[] = [];
  for (const id of presets.unknownPresetIds) {
    warnings.push({
      code: "UNKNOWN_PRESET",
      message: `未找到预设：${id}`,
      field: "presetIds",
      severity: "warning",
    });
  }

  const configuration = validatePromptConfiguration(
    parametersWithNegativeBlocks(reconciled.parameters, blocks),
    input.references ?? {
      imagePrompts: [],
      styleReferences: [],
      omniReference: null,
      videoStart: null,
      videoEnd: null,
    },
    {
    targetSurface,
    taskType,
    },
  );
  warnings.push(...configuration.warnings);
  if (!configuration.valid) {
    throw new Error(
      configuration.warnings.find((warning) => warning.severity === "error")?.message ??
        "Midjourney 参数无效。",
    );
  }

  const { bodyZh: positiveZh, bodyEn: positiveEn } = composePromptBodies(blocks);
  const bodyZh = positiveZh || positiveEn;
  const bodyEn = positiveEn || positiveZh;
  if (!bodyZh && !bodyEn) {
    throw new Error("请至少填写一个创意、词块或结构字段。");
  }

  const promptZh = composePromptWithReferences(
    bodyZh,
    configuration.parameters,
    configuration.references,
    { targetSurface, taskType },
  );
  const promptEn = composePromptWithReferences(
    bodyEn,
    configuration.parameters,
    configuration.references,
    { targetSurface, taskType },
  );
  const normalizedFields = blocksToFields(blocks, "zh");
  const normalizedTranslated = blocksToFields(blocks, "en");
  const variant = {
    id: "detailed" as const,
    label: "详细",
    blocks,
    bodyZh,
    bodyEn,
    promptZh,
    promptEn,
  };

  return {
    schemaVersion: 4,
    variants: [variant],
    selectedVariant: "detailed",
    blocks,
    bilingualSyncEnabled: /[\u3400-\u9fff]/.test(idea),
    targetSurface,
    taskType,
    bodyZh,
    bodyEn,
    promptZh,
    promptEn,
    fields: normalizedFields,
    translatedFields: normalizedTranslated,
    parameters: configuration.parameters,
    references: configuration.references,
    warnings,
    source: "rule",
  };
}

export function insertPhraseAtCursor(
  currentValue: string,
  phrase: string,
  selectionStart?: number | null,
  selectionEnd?: number | null,
): { value: string; cursor: number } {
  const start = selectionStart ?? currentValue.length;
  const end = selectionEnd ?? start;
  const safeStart = clamp(start, 0, currentValue.length);
  const safeEnd = clamp(end, safeStart, currentValue.length);
  const prefix = currentValue.slice(0, safeStart);
  const suffix = currentValue.slice(safeEnd);
  const needsLeadingSeparator = prefix.length > 0 && !/[\s,，]$/.test(prefix);
  const needsTrailingSeparator = suffix.length > 0 && !/^[\s,，]/.test(suffix);
  const insertion = `${needsLeadingSeparator ? ", " : ""}${phrase.trim()}${
    needsTrailingSeparator ? ", " : ""
  }`;
  return {
    value: `${prefix}${insertion}${suffix}`,
    cursor: prefix.length + insertion.length,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function promptFieldLabel(key: PromptFieldKey): string {
  return {
    subject: "主体",
    action: "动作与表情",
    environment: "场景与环境",
    composition: "构图与视角",
    camera: "镜头与景别",
    lighting: "光线",
    color: "色彩",
    material: "材质",
    medium: "艺术媒介",
    style: "风格",
    mood: "氛围",
    negative: "排除内容",
  }[key];
}
