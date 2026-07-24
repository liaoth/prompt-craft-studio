import {
  PromptParametersSchema,
  type PromptParameters,
  type PromptWarning,
} from "./types";

const MAX_SEED = 4_294_967_295;
const QUALITY_BY_MODEL: Record<NonNullable<PromptParameters["model"]>, readonly number[]> = {
  "8.1": [],
  "8": [1, 2, 4],
  "7": [1, 2, 4],
  "6.1": [0.5, 1, 2],
  "6": [0.5, 1, 2],
  "niji-7": [1, 2, 4],
  "niji-6": [0.25, 0.5, 1],
};

export interface ParameterValidationResult {
  valid: boolean;
  parameters: PromptParameters;
  warnings: PromptWarning[];
}

export function validateParameters(input: unknown): ParameterValidationResult {
  const parsed = PromptParametersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      parameters: {},
      warnings: parsed.error.issues.map((issue) => ({
        code: "invalid_parameter_shape",
        field: issue.path.join(".") || undefined,
        message: issue.message,
        severity: "error",
      })),
    };
  }

  const parameters = parsed.data;
  const warnings: PromptWarning[] = [];

  checkIntegerRange(warnings, "stylize", parameters.stylize, 0, 1_000);
  checkIntegerRange(warnings, "chaos", parameters.chaos, 0, 100);
  checkIntegerRange(warnings, "weird", parameters.weird, 0, 3_000);
  checkIntegerRange(warnings, "seed", parameters.seed, 0, MAX_SEED);

  if (parameters.aspectRatio !== undefined) {
    const match = /^(\d+):(\d+)$/.exec(parameters.aspectRatio);
    if (!match) {
      addError(
        warnings,
        "aspectRatio",
        "invalid_aspect_ratio",
        "画面比例必须使用正整数“宽:高”格式，例如 16:9。",
      );
    } else {
      const width = Number(match[1]);
      const height = Number(match[2]);
      const ratio = width / height;
      if (width < 1 || height < 1 || ratio < 1 / 14 || ratio > 14) {
        addError(
          warnings,
          "aspectRatio",
          "aspect_ratio_out_of_range",
          "当前模型的画面比例必须在 1:14 到 14:1 之间。",
        );
      }
    }
  }

  if (parameters.quality !== undefined) {
    const model = parameters.model ?? "7";
    const supported = QUALITY_BY_MODEL[model];
    if (!supported.includes(parameters.quality)) {
      addError(
        warnings,
        "quality",
        "unsupported_quality",
        supported.length
          ? `模型 ${model} 支持的 Quality 值为 ${supported.join("、")}。`
          : `模型 ${model} 不支持 Quality 参数。`,
      );
    }
  }

  if (parameters.weird !== undefined && parameters.seed !== undefined) {
    addWarning(
      warnings,
      "seed",
      "weird_seed_interaction",
      "Weird 与 Seed 不能完全兼容，使用相同 Seed 时结果仍可能有明显差异。",
    );
  }

  if (parameters.tile && parameters.aspectRatio && parameters.aspectRatio !== "1:1") {
    addWarning(
      warnings,
      "aspectRatio",
      "tile_aspect_ratio",
      "Tile 通常使用 1:1 才能得到可无缝重复的方形纹理。",
    );
  }

  if (parameters.no?.some((item) => item.includes("--"))) {
    addWarning(
      warnings,
      "no",
      "nested_parameter",
      "排除内容中包含“--”，可能被 Midjourney 解析成额外参数。",
    );
  }

  return {
    valid: !warnings.some((warning) => warning.severity === "error"),
    parameters,
    warnings,
  };
}

export function serializeParameters(parameters: PromptParameters): string {
  const validation = validateParameters(parameters);
  const value = validation.parameters;
  const invalidFields = new Set(
    validation.warnings
      .filter((warning) => warning.severity === "error" && warning.field)
      .map((warning) => warning.field),
  );
  const chunks: string[] = [];

  if (value.model === "niji-7") chunks.push("--niji 7");
  else if (value.model === "niji-6") chunks.push("--niji 6");
  else if (value.model) chunks.push(`--v ${value.model}`);
  if (value.aspectRatio && !invalidFields.has("aspectRatio")) {
    chunks.push(`--ar ${value.aspectRatio}`);
  }
  if (value.stylize !== undefined && !invalidFields.has("stylize")) {
    chunks.push(`--s ${value.stylize}`);
  }
  if (value.chaos !== undefined && !invalidFields.has("chaos")) {
    chunks.push(`--c ${value.chaos}`);
  }
  if (
    value.weird !== undefined &&
    !invalidFields.has("weird")
  ) {
    chunks.push(`--weird ${value.weird}`);
  }
  if (value.quality !== undefined && !invalidFields.has("quality")) {
    chunks.push(`--q ${value.quality}`);
  }
  if (value.seed !== undefined && !invalidFields.has("seed")) {
    chunks.push(`--seed ${value.seed}`);
  }
  if (value.raw) chunks.push("--raw");
  if (value.tile) chunks.push("--tile");
  if (value.no?.length) chunks.push(`--no ${value.no.join(", ")}`);

  return chunks.join(" ");
}

function checkIntegerRange(
  warnings: PromptWarning[],
  field: keyof PromptParameters,
  value: number | undefined,
  min: number,
  max: number,
): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < min || value > max) {
    addError(
      warnings,
      field,
      "parameter_out_of_range",
      `${field} 必须是 ${min} 到 ${max} 之间的整数。`,
    );
  }
}

function addError(
  warnings: PromptWarning[],
  field: keyof PromptParameters,
  code: string,
  message: string,
): void {
  warnings.push({ field, code, message, severity: "error" });
}

function addWarning(
  warnings: PromptWarning[],
  field: keyof PromptParameters,
  code: string,
  message: string,
): void {
  warnings.push({ field, code, message, severity: "warning" });
}
