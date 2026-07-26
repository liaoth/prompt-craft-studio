import {
  PARAMETER_BY_ALIAS,
  PARAMETER_BY_ID,
  PARAMETER_REGISTRY,
  type ParameterDefinition,
} from "./parameter-registry";
import {
  PromptParametersSchema,
  type MidjourneyModel,
  type PromptParameters,
  type PromptReferences,
  type PromptWarning,
  type TargetSurface,
  type TaskType,
} from "./types";

const QUALITY_BY_MODEL: Record<MidjourneyModel, readonly number[]> = {
  "8.2": [],
  "8.1": [],
  "8": [],
  "7": [1, 2, 4],
  "6.1": [0.5, 1, 2],
  "6": [0.5, 1, 2],
  "niji-7": [1, 2, 4],
  "niji-6": [0.25, 0.5, 1],
};

export interface ParameterValidationContext {
  targetSurface?: TargetSurface;
  taskType?: TaskType;
  allowLegacyModel?: boolean;
  references?: PromptReferences;
}

export interface ParameterValidationResult {
  valid: boolean;
  parameters: PromptParameters;
  warnings: PromptWarning[];
}

export interface PromptParameterExtraction {
  body: string;
  parameters: PromptParameters;
  warnings: PromptWarning[];
}

export interface ParameterAvailabilityContext {
  model: MidjourneyModel;
  targetSurface: TargetSurface;
  taskType: TaskType;
  allowLegacyModel?: boolean;
}

export interface ParameterAvailability {
  supported: boolean;
  reason?: string;
}

export function parameterAvailability(
  definition: ParameterDefinition,
  context: ParameterAvailabilityContext,
): ParameterAvailability {
  if (!definition.surfaces.includes(context.targetSurface)) {
    return {
      supported: false,
      reason: `不支持${
        context.targetSurface === "web" ? "Midjourney Web" : "Discord"
      }入口`,
    };
  }
  if (!definition.tasks.includes(context.taskType)) {
    return {
      supported: false,
      reason: `不支持${context.taskType === "image" ? "图像" : "视频"}任务`,
    };
  }
  if (
    definition.models &&
    !definition.models.includes(context.model) &&
    !(
      definition.id === "model" &&
      context.model === "8" &&
      context.allowLegacyModel
    )
  ) {
    return {
      supported: false,
      reason: `模型 ${context.model} 不支持`,
    };
  }
  if (
    definition.id === "quality" &&
    supportedParameterOptions(definition, context.model).length === 0
  ) {
    return {
      supported: false,
      reason: `模型 ${context.model} 不支持 Quality`,
    };
  }
  return { supported: true };
}

export function supportedParameterOptions(
  definition: ParameterDefinition,
  model: MidjourneyModel,
): readonly (string | number)[] {
  if (definition.id === "quality") return QUALITY_BY_MODEL[model];
  if (definition.id === "speedMode" && ["8.2", "8.1"].includes(model)) {
    return (definition.options ?? []).filter((option) => option !== "turbo");
  }
  return definition.options ?? [];
}

export function filterUnsupportedParameters(
  parameters: PromptParameters,
  context: Omit<ParameterAvailabilityContext, "model"> & {
    model?: MidjourneyModel;
  },
): PromptParameters {
  const model = context.model ?? parameters.model ?? "8.2";
  const next: PromptParameters = {};
  for (const definition of PARAMETER_REGISTRY) {
    const value = parameters[definition.id];
    if (
      isPresent(value) &&
      parameterAvailability(definition, { ...context, model }).supported
    ) {
      Object.assign(next, { [definition.id]: value });
    }
  }
  if (context.taskType === "image") next.model = model;
  return next;
}

export function validateParameters(
  input: unknown,
  context: ParameterValidationContext = {},
): ParameterValidationResult {
  const parsed = PromptParametersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      parameters: {},
      warnings: parsed.error.issues.map((issue) => ({
        code: "INVALID_PARAMETER_SHAPE",
        field: issue.path.join(".") || undefined,
        message: issue.message,
        severity: "error",
      })),
    };
  }

  const parameters: PromptParameters = {
    ...parsed.data,
    omniReference: undefined,
    styleReference: undefined,
    end: undefined,
    videoQuality: undefined,
  };
  const targetSurface = context.targetSurface ?? "web";
  const taskType = context.taskType ?? "image";
  const model = parameters.model ?? "8.2";
  const warnings: PromptWarning[] = [];

  if (model === "8" && !context.allowLegacyModel) {
    warnings.push({
      code: "DEPRECATED_MODEL",
      field: "model",
      message: "V8.0 已停用，只能用于恢复旧快照。",
      suggestion: "请改用 V8.2。",
      severity: "error",
      docsUrl: "https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version",
    });
  } else if (model === "8") {
    warnings.push({
      code: "DEPRECATED_MODEL",
      field: "model",
      message: "这是旧快照中的 V8.0 参数，Midjourney 已不再提供该模型。",
      suggestion: "恢复编辑后建议改用 V8.2。",
      severity: "warning",
    });
  }

  for (const definition of PARAMETER_REGISTRY) {
    const value = parameters[definition.id];
    if (!isPresent(value)) continue;

    if (!definition.surfaces.includes(targetSurface)) {
      addError(
        warnings,
        definition.id,
        "UNSUPPORTED_SURFACE",
        `${definition.label} 不支持 ${targetSurface === "web" ? "Midjourney Web" : "Discord"} 入口。`,
        definition,
      );
    }
    if (!definition.tasks.includes(taskType)) {
      addError(
        warnings,
        definition.id,
        "UNSUPPORTED_TASK",
        `${definition.label} 不支持${taskType === "image" ? "图像" : "视频"}任务。`,
        definition,
      );
    }
    if (
      definition.models &&
      !definition.models.includes(model) &&
      !(definition.id === "model" && model === "8" && context.allowLegacyModel)
    ) {
      addError(
        warnings,
        definition.id,
        "UNSUPPORTED_MODEL",
        `${definition.label} 不支持模型 ${model}。`,
        definition,
      );
    }

    if (typeof value === "number") {
      validateNumber(warnings, definition, value);
    }

    for (const conflict of definition.conflicts ?? []) {
      if (isPresent(parameters[conflict]) && definition.id < conflict) {
        addError(
          warnings,
          definition.id,
          "PARAMETER_CONFLICT",
          `${definition.label} 与 ${PARAMETER_BY_ID.get(conflict)?.label ?? conflict} 不能同时使用。`,
          definition,
        );
      }
    }
  }

  validateAspectRatio(parameters.aspectRatio, parameters.imageResolution, warnings);
  validateQuality(model, parameters.quality, warnings);
  if (parameters.imageWeight !== undefined && taskType !== "image") {
    addError(warnings, "imageWeight", "IMAGE_ONLY", "Image Weight 只适用于图像任务。");
  }
  if (
    parameters.imageWeight !== undefined &&
    model === "niji-7" &&
    parameters.imageWeight > 2
  ) {
    addError(
      warnings,
      "imageWeight",
      "IMAGE_WEIGHT_MODEL_RANGE",
      "Niji 7 的 Image Weight 范围是 0–2。",
    );
  }
  if (parameters.speedMode === "turbo" && ["8.2", "8.1"].includes(model)) {
    addError(
      warnings,
      "speedMode",
      "TURBO_UNSUPPORTED",
      `模型 ${model} 不支持 Turbo，请使用 Fast 或 Relax。`,
    );
  }
  if (parameters.draft && model === "8.1" && targetSurface !== "web") {
    addError(
      warnings,
      "draft",
      "DRAFT_WEB_ONLY",
      "V8.1 的 Draft 仅在 Midjourney Web 中可用。",
    );
  }
  if (parameters.tile && parameters.aspectRatio && parameters.aspectRatio !== "1:1") {
    addWarning(
      warnings,
      "aspectRatio",
      "tile_aspect_ratio",
      "无缝纹理通常使用 1:1 画面比例。",
    );
  }
  if (parameters.weird !== undefined && parameters.seed !== undefined) {
    addWarning(
      warnings,
      "seed",
      "weird_seed_interaction",
      "Weird 与 Seed 不能保证完全可复现，相同 Seed 的结果仍可能明显不同。",
    );
  }
  if (parameters.no?.some((item) => item.includes("--"))) {
    addError(
      warnings,
      "no",
      "NESTED_PARAMETER",
      "排除内容不能包含另一个 Midjourney 参数。",
    );
  }

  return {
    valid: !warnings.some((warning) => warning.severity === "error"),
    parameters:
      taskType === "image"
        ? { ...parameters, model }
        : { ...parameters, model: undefined },
    warnings: dedupeWarnings(warnings),
  };
}

export function serializeParameters(
  parameters: PromptParameters,
  context: ParameterValidationContext = {},
): string {
  const validation = validateParameters(parameters, context);
  const invalidFields = new Set(
    validation.warnings
      .filter((warning) => warning.severity === "error" && warning.field)
      .map((warning) => warning.field),
  );
  const value = validation.parameters;
  const chunks: string[] = [];

  const serializationOrder = [
    ...PARAMETER_REGISTRY.filter((definition) => definition.id !== "no"),
    ...PARAMETER_REGISTRY.filter((definition) => definition.id === "no"),
  ];
  for (const definition of serializationOrder) {
    if (invalidFields.has(definition.id)) continue;
    const current = value[definition.id];
    if (!isPresent(current)) continue;
    const serialized = serializeValue(definition, current);
    if (serialized) chunks.push(serialized);
  }
  return chunks.join(" ");
}

export function appendParameterSuffix(body: string, suffix: string): string {
  const trimmed = body.trim();
  return suffix ? `${trimmed} ${suffix}`.trim() : trimmed;
}

/**
 * Pulls recognized parameters out of pasted prose. Parameters can be anywhere in
 * the input; the normalized serializer always places them at the end. If a flag
 * occurs more than once, the last explicit value wins.
 */
export function extractParametersFromPrompt(
  prompt: string,
  base: PromptParameters = {},
  context: ParameterValidationContext = {},
): PromptParameterExtraction {
  const matches = [...prompt.matchAll(/(?:^|\s)(--[a-z][a-z-]*)(?=\s|$)/gi)];
  if (!matches.length) {
    return { body: prompt.trim(), parameters: base, warnings: [] };
  }

  const parameters: Record<string, unknown> = { ...base };
  const warnings: PromptWarning[] = [];
  const removals: Array<[number, number]> = [];
  const seen = new Set<keyof PromptParameters>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const rawFlag = match[1].toLowerCase();
    const definition = PARAMETER_BY_ALIAS.get(rawFlag);
    if (!definition) continue;
    const start = (match.index ?? 0) + (match[0].length - match[1].length);
    const segmentEnd = index + 1 < matches.length ? matches[index + 1].index! : prompt.length;
    const rawSegment = prompt.slice(start + match[1].length, segmentEnd);
    const leadingWhitespace = rawSegment.length - rawSegment.trimStart().length;
    const rawValue = consumableParameterValue(definition, rawFlag, rawSegment.trimStart());
    const parsedValue = parseParameterValue(definition, rawFlag, rawValue);
    if (parsedValue === undefined) {
      warnings.push({
        code: "INVALID_PASTED_PARAMETER",
        field: definition.id,
        message: `无法解析 ${match[1]} 的值。`,
        severity: "error",
      });
      continue;
    }
    if (seen.has(definition.id)) {
      warnings.push({
        code: "DUPLICATE_PARAMETER",
        field: definition.id,
        message: `${definition.label} 重复出现，已采用最后一个显式值。`,
        severity: "warning",
      });
    }
    seen.add(definition.id);
    parameters[definition.id] = parsedValue;
    if (rawFlag === "--style" && definition.id === "raw") {
      warnings.push({
        code: "DEPRECATED_PARAMETER",
        field: "raw",
        message: "旧参数 --style raw 已归一化为 --raw。",
        suggestion: "请使用 --raw。",
        severity: "warning",
      });
    }
    const consumedEnd =
      start +
      match[1].length +
      leadingWhitespace +
      rawValue.length;
    removals.push([start, consumedEnd]);
  }

  let body = prompt;
  for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
    body = `${body.slice(0, start)} ${body.slice(end)}`;
  }
  body = body.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
  const validation = validateParameters(parameters, context);
  return {
    body,
    parameters: validation.parameters,
    warnings: dedupeWarnings([...warnings, ...validation.warnings]),
  };
}

function parseParameterValue(
  definition: ParameterDefinition,
  rawFlag: string,
  rawValue: string,
): unknown {
  if (definition.id === "model") {
    if (rawFlag === "--niji") return `niji-${rawValue.split(/\s+/)[0]}`;
    return rawValue.split(/\s+/)[0];
  }
  if (definition.id === "visibility") return rawFlag === "--stealth" ? "stealth" : "public";
  if (definition.id === "speedMode") {
    if (rawFlag === "--relax") return "relax";
    if (rawFlag === "--turbo") return "turbo";
    return "fast";
  }
  if (definition.id === "imageResolution") return rawFlag === "--hd" ? "hd" : "sd";
  if (definition.id === "raw" && rawFlag === "--style") {
    return rawValue.split(/\s+/)[0]?.toLowerCase() === "raw" ? true : undefined;
  }
  if (definition.valueType === "boolean") return true;
  if (definition.valueType === "number") {
    const value = Number(rawValue.split(/\s+/)[0]);
    return Number.isFinite(value) ? value : undefined;
  }
  if (definition.valueType === "string-list") {
    const values = rawValue
      .split(definition.id === "no" ? "," : /\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    return values.length ? values : undefined;
  }
  if (definition.valueType === "select") {
    return rawValue.split(/\s+/)[0] || undefined;
  }
  return rawValue || undefined;
}

function consumableParameterValue(
  definition: ParameterDefinition,
  rawFlag: string,
  rawSegment: string,
): string {
  if (
    definition.valueType === "boolean" &&
    !(definition.id === "raw" && rawFlag === "--style")
  ) {
    return "";
  }
  if (definition.valueType === "string-list") return rawSegment.trimEnd();
  return rawSegment.split(/\s+/)[0] ?? "";
}

function serializeValue(definition: ParameterDefinition, value: unknown): string {
  if (definition.id === "model") {
    const model = String(value);
    return model.startsWith("niji-") ? `--niji ${model.slice(5)}` : `--v ${model}`;
  }
  if (definition.id === "visibility") return value === "stealth" ? "--stealth" : "--public";
  if (definition.id === "speedMode") return `--${String(value)}`;
  if (definition.id === "imageResolution") return `--${String(value)}`;
  if (definition.valueType === "boolean") return value ? definition.flag : "";
  if (Array.isArray(value)) {
    const joined = definition.id === "no" ? value.join(", ") : value.join(" ");
    return joined ? `${definition.flag} ${joined}` : "";
  }
  return `${definition.flag} ${String(value)}`;
}

function validateNumber(
  warnings: PromptWarning[],
  definition: ParameterDefinition,
  value: number,
): void {
  if (definition.min !== undefined && value < definition.min) {
    addError(
      warnings,
      definition.id,
      "parameter_out_of_range",
      `${definition.label} 不能小于 ${definition.min}。`,
      definition,
    );
  }
  if (definition.max !== undefined && value > definition.max) {
    addError(
      warnings,
      definition.id,
      "parameter_out_of_range",
      `${definition.label} 不能大于 ${definition.max}。`,
      definition,
    );
  }
  if (definition.step === 1 && !Number.isInteger(value)) {
    addError(
      warnings,
      definition.id,
      "PARAMETER_NOT_INTEGER",
      `${definition.label} 必须是整数。`,
      definition,
    );
  }
  if (definition.options?.length && !definition.options.includes(value)) {
    addError(
      warnings,
      definition.id,
      "PARAMETER_OPTION_INVALID",
      `${definition.label} 仅支持：${definition.options.join("、")}。`,
      definition,
    );
  }
}

function validateAspectRatio(
  value: string | undefined,
  resolution: "sd" | "hd" | undefined,
  warnings: PromptWarning[],
): void {
  if (!value) return;
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) {
    addError(warnings, "aspectRatio", "INVALID_ASPECT_RATIO", "画面比例必须使用“宽:高”，例如 16:9。");
    return;
  }
  const ratio = Number(match[1]) / Number(match[2]);
  if (!Number.isFinite(ratio) || ratio < 1 / 14 || ratio > 14) {
    addError(
      warnings,
      "aspectRatio",
      "ASPECT_RATIO_OUT_OF_RANGE",
      "画面比例必须在 1:14 到 14:1 之间。",
    );
  }
  if (resolution === "hd" && (ratio < 1 / 4 || ratio > 4)) {
    addError(
      warnings,
      "aspectRatio",
      "HD_ASPECT_RATIO_OUT_OF_RANGE",
      "HD 图像模式的画面比例必须在 1:4 到 4:1 之间。",
    );
  }
}

function validateQuality(
  model: MidjourneyModel,
  value: number | undefined,
  warnings: PromptWarning[],
): void {
  if (value === undefined) return;
  const options = QUALITY_BY_MODEL[model] ?? [];
  if (!options.includes(value)) {
    addError(
      warnings,
      "quality",
      "unsupported_quality",
      options.length
        ? `模型 ${model} 支持的 Quality 为 ${options.join("、")}。`
        : `模型 ${model} 不支持 Quality 参数。`,
    );
  }
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}

function addError(
  warnings: PromptWarning[],
  field: keyof PromptParameters,
  code: string,
  message: string,
  definition?: ParameterDefinition,
): void {
  warnings.push({
    field,
    code,
    message,
    severity: "error",
    docsUrl: definition?.docsUrl,
  });
}

function addWarning(
  warnings: PromptWarning[],
  field: keyof PromptParameters,
  code: string,
  message: string,
): void {
  warnings.push({ field, code, message, severity: "warning" });
}

function dedupeWarnings(warnings: PromptWarning[]): PromptWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.field ?? ""}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
