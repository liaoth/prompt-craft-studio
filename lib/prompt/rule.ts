import { resolvePresetFields } from "./presets";
import { serializeParameters, validateParameters } from "./parameters";
import {
  PROMPT_FIELD_ORDER,
  PromptFieldsSchema,
  TranslatedPromptFieldsSchema,
  type PromptDraft,
  type PromptFieldKey,
  type PromptFields,
  type PromptParameters,
  type PromptWarning,
} from "./types";

export interface GenerateRulePromptInput {
  fields: Partial<PromptFields>;
  translatedFields?: Partial<PromptFields>;
  presetIds?: readonly string[];
  parameters?: PromptParameters;
  custom?: string;
  translatedCustom?: string;
}

export function generateRulePrompt(input: GenerateRulePromptInput): PromptDraft {
  const fields = PromptFieldsSchema.parse(input.fields);
  const translatedFields = TranslatedPromptFieldsSchema.parse(input.translatedFields ?? {});
  const custom = input.custom?.trim() ?? "";
  const translatedCustom = input.translatedCustom?.trim() ?? "";
  const presets = resolvePresetFields(input.presetIds ?? []);
  const parameterResult = validateParameters(input.parameters ?? {});
  const warnings: PromptWarning[] = [...parameterResult.warnings];

  for (const id of presets.unknownPresetIds) {
    warnings.push({
      code: "unknown_preset",
      message: `未找到预设：${id}`,
      field: "presetIds",
      severity: "warning",
    });
  }

  const zhSegments = collectSegments(fields, presets.fieldsZh);
  const enSource = PROMPT_FIELD_ORDER.reduce<PromptFields>((result, key) => {
    result[key] = translatedFields[key]?.trim() || fields[key];
    return result;
  }, PromptFieldsSchema.parse({}));
  const enSegments = collectSegments(enSource, presets.fieldsEn);
  const negativeZh = mergeParts(fields.negative, presets.fieldsZh.negative);
  const negativeEn = mergeParts(enSource.negative, presets.fieldsEn.negative);
  const suffix = serializeParameters(parameterResult.parameters);

  const basePromptZh = mergeParts(zhSegments.join(", ") || enSegments.join(", "), custom);
  const basePromptEn = mergeParts(
    enSegments.join(", ") || zhSegments.join(", "),
    translatedCustom || custom,
  );

  if (!basePromptZh && !basePromptEn) {
    throw new Error("Need at least one structured field or custom phrase.");
  }

  const promptZh = appendNegativeAndParameters(
    basePromptZh,
    negativeZh,
    suffix,
    "exclude",
  );
  const promptEn = appendNegativeAndParameters(
    basePromptEn,
    negativeEn,
    suffix,
    "exclude",
  );

  return {
    promptZh,
    promptEn,
    fields,
    translatedFields,
    parameters: parameterResult.parameters,
    warnings,
    source: "rule",
  };
}

function collectSegments(fields: PromptFields, presetFields: PromptFields): string[] {
  const segments: string[] = [];
  for (const key of PROMPT_FIELD_ORDER) {
    if (key === "negative") continue;
    const value = mergeParts(fields[key], presetFields[key]);
    if (value) segments.push(value);
  }
  return segments;
}

function mergeParts(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function appendNegativeAndParameters(
  body: string,
  negative: string,
  suffix: string,
  negativeLabel: string,
): string {
  const withNegative = negative ? `${body}, ${negativeLabel}: ${negative}` : body;
  return suffix ? `${withNegative} ${suffix}` : withNegative;
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
  const value = `${prefix}${insertion}${suffix}`;
  return { value, cursor: prefix.length + insertion.length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function promptFieldLabel(key: PromptFieldKey): string {
  return {
    subject: "主体",
    action: "动作与表情",
    environment: "场景与环境",
    medium: "艺术媒介",
    style: "风格",
    composition: "构图",
    camera: "镜头",
    lighting: "光线",
    color: "色彩",
    material: "材质",
    mood: "氛围",
    negative: "排除内容",
  }[key];
}
