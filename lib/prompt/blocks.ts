import {
  PROMPT_BLOCK_FIELD_ORDER,
  PROMPT_FIELD_ORDER,
  PromptFieldsSchema,
  type PromptBlock,
  type PromptBlockField,
  type PromptBlockOrigin,
  type PromptFields,
  type PromptParameters,
  type TranslatedPromptFields,
} from "./types";

export const PROMPT_FIELD_LABELS: Record<PromptBlockField, string> = {
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
  custom: "自定义补充",
};

export function createPromptBlock(
  field: PromptBlockField,
  textZh: string,
  textEn = "",
  origin: PromptBlockOrigin = "user",
  order = 0,
  id = createBlockId(),
): PromptBlock {
  return {
    id,
    field,
    order,
    textZh: textZh.trim(),
    textEn: textEn.trim(),
    textEnMode: "auto",
    origin,
  };
}

export function fieldsToBlocks(
  fields: Partial<PromptFields>,
  translatedFields: Partial<TranslatedPromptFields> = {},
  origin: PromptBlockOrigin = "user",
): PromptBlock[] {
  return PROMPT_FIELD_ORDER.flatMap((field) => {
    const textZh = fields[field]?.trim() ?? "";
    const textEn = translatedFields[field]?.trim() ?? "";
    if (!textZh && !textEn) return [];
    return [createPromptBlock(field, textZh, textEn || textZh, origin, 0)];
  });
}

export function blocksToFields(blocks: readonly PromptBlock[], language: "zh" | "en"): PromptFields {
  const result = PromptFieldsSchema.parse({});
  for (const field of PROMPT_FIELD_ORDER) {
    result[field] = orderedBlocks(blocks, field)
      .map((block) => (language === "zh" ? block.textZh : block.textEn || block.textZh))
      .filter(Boolean)
      .join(", ");
  }
  return result;
}

export function normalizeBlockOrder(blocks: readonly PromptBlock[]): PromptBlock[] {
  const counters = new Map<PromptBlockField, number>();
  return [...blocks]
    .sort((left, right) => {
      const fieldDelta =
        PROMPT_BLOCK_FIELD_ORDER.indexOf(left.field) -
        PROMPT_BLOCK_FIELD_ORDER.indexOf(right.field);
      return fieldDelta || left.order - right.order;
    })
    .map((block) => {
      const order = counters.get(block.field) ?? 0;
      counters.set(block.field, order + 1);
      return { ...block, order };
    });
}

export function composePromptBodies(blocks: readonly PromptBlock[]): {
  bodyZh: string;
  bodyEn: string;
} {
  const positives = PROMPT_BLOCK_FIELD_ORDER.filter(
    (field) => field !== "negative",
  );
  const bodyZh = positives
    .flatMap((field) => orderedBlocks(blocks, field).map((block) => block.textZh))
    .filter(Boolean)
    .join(", ");
  const bodyEn = positives
    .flatMap((field) =>
      orderedBlocks(blocks, field).map((block) => block.textEn || block.textZh),
    )
    .filter(Boolean)
    .join(", ");
  return { bodyZh, bodyEn };
}

export function negativeValues(
  blocks: readonly PromptBlock[],
  language: "zh" | "en",
): string[] {
  return orderedBlocks(blocks, "negative")
    .map((block) =>
      language === "zh"
        ? block.textZh || block.textEn
        : block.textEn || block.textZh,
    )
    .filter(Boolean);
}

export function stripNegativeParameter(
  parameters: PromptParameters,
): PromptParameters {
  const rest = { ...parameters };
  delete rest.no;
  return rest;
}

export function parametersWithNegativeBlocks(
  parameters: PromptParameters,
  blocks: readonly PromptBlock[],
): PromptParameters {
  const rest = stripNegativeParameter(parameters);
  const no = dedupeTextValues(negativeValues(blocks, "en"));
  return no.length ? { ...rest, no } : rest;
}

export function reconcileNegativeBlocks(
  blocks: readonly PromptBlock[],
  parameters: PromptParameters,
): { blocks: PromptBlock[]; parameters: PromptParameters } {
  const next = [...blocks];
  const seen = new Set(
    orderedBlocks(next, "negative")
      .map((block) => normalizeTextKey(block.textEn || block.textZh))
      .filter(Boolean),
  );
  for (const value of dedupeTextValues(parameters.no ?? [])) {
    const key = normalizeTextKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(
      createPromptBlock(
        "negative",
        "",
        value,
        "legacy",
        orderedBlocks(next, "negative").length,
      ),
    );
  }
  return {
    blocks: normalizeBlockOrder(next),
    parameters: stripNegativeParameter(parameters),
  };
}

export function movePromptBlock(
  blocks: readonly PromptBlock[],
  activeId: string,
  targetField: PromptBlockField,
  targetIndex: number,
): PromptBlock[] {
  const active = blocks.find((block) => block.id === activeId);
  if (!active) return [...blocks];
  const without = blocks.filter((block) => block.id !== activeId);
  const target = orderedBlocks(without, targetField);
  const safeIndex = Math.max(0, Math.min(targetIndex, target.length));
  target.splice(safeIndex, 0, { ...active, field: targetField });
  const reorderedTarget = target.map((block, order) => ({ ...block, order }));
  const targetIds = new Set(reorderedTarget.map((block) => block.id));
  return normalizeBlockOrder([
    ...without.filter((block) => block.field !== targetField && !targetIds.has(block.id)),
    ...reorderedTarget,
  ]);
}

export function orderedBlocks(
  blocks: readonly PromptBlock[],
  field: PromptBlockField,
): PromptBlock[] {
  return blocks
    .filter((block) => block.field === field)
    .sort((left, right) => left.order - right.order);
}

function createBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dedupeTextValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ");
    const key = normalizeTextKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function normalizeTextKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
