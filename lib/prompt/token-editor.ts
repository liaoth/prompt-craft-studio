import {
  createPromptBlock,
  normalizeBlockOrder,
  orderedBlocks,
} from "./blocks";
import type {
  PromptBlock,
  PromptBlockField,
} from "./types";

const TOKEN_SPLIT_PATTERN = /[\n\r,，]+/;

export function splitPromptTokenInput(value: string): string[] {
  return value
    .split(TOKEN_SPLIT_PATTERN)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function updatePromptBlockText(
  blocks: readonly PromptBlock[],
  id: string,
  language: "zh" | "en",
  value: string,
): PromptBlock[] {
  const text = value.trim();
  if (!text) return blocks.filter((block) => block.id !== id);
  return blocks.map((block) => {
    if (block.id !== id) return block;
    if (language === "en") {
      return { ...block, textEn: text, textEnMode: "manual" as const };
    }
    return {
      ...block,
      textZh: text,
      textEn: block.textEnMode === "manual" ? block.textEn : "",
    };
  });
}

export function unlockPromptBlockEnglish(
  blocks: readonly PromptBlock[],
  id: string,
): PromptBlock[] {
  return blocks.map((block) =>
    block.id === id
      ? { ...block, textEn: "", textEnMode: "auto" as const }
      : block,
  );
}

export function appendPromptTokenBlocks(
  blocks: readonly PromptBlock[],
  language: "zh" | "en",
  values: readonly string[],
  field: PromptBlockField = "custom",
): PromptBlock[] {
  const startOrder = orderedBlocks(blocks, field).length;
  const incoming = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => {
      const block = createPromptBlock(
        field,
        language === "zh" ? value : "",
        language === "en" ? value : "",
        "user",
        startOrder + index,
      );
      return language === "en"
        ? { ...block, textEnMode: "manual" as const }
        : block;
    });
  return normalizeBlockOrder([...blocks, ...incoming]);
}
