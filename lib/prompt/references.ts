import { appendParameterSuffix, serializeParameters, validateParameters } from "./parameters";
import {
  PromptReferencesSchema,
  type MidjourneyModel,
  type PromptParameters,
  type PromptReferenceAsset,
  type PromptReferenceKind,
  type PromptReferences,
  type PromptWarning,
  type TargetSurface,
  type TaskType,
} from "./types";

export const EMPTY_PROMPT_REFERENCES: PromptReferences = PromptReferencesSchema.parse({});

export interface PromptReferenceContext {
  targetSurface: TargetSurface;
  taskType: TaskType;
  parameters: PromptParameters;
}

export interface PromptReferenceExtraction {
  body: string;
  references: PromptReferences;
  warnings: PromptWarning[];
}

export function createPromptReference(
  kind: PromptReferenceKind,
  value: string,
  order = 0,
  valueType: "url" | "code" = "url",
): PromptReferenceAsset {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `reference-${Date.now()}-${Math.random()}`,
    kind,
    valueType,
    value: value.trim(),
    order,
  };
}

export function normalizePromptReferences(references: PromptReferences): PromptReferences {
  const normalize = (items: PromptReferenceAsset[]) =>
    [...items]
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .map((item, order) => ({ ...item, order }));
  return PromptReferencesSchema.parse({
    imagePrompts: normalize(references.imagePrompts),
    styleReferences: normalize(references.styleReferences),
    omniReference: references.omniReference
      ? { ...references.omniReference, order: 0 }
      : null,
    videoStart: references.videoStart ? { ...references.videoStart, order: 0 } : null,
    videoEnd: references.videoEnd ? { ...references.videoEnd, order: 0 } : null,
  });
}

export function validatePromptReferences(
  input: unknown,
  context: PromptReferenceContext,
): { valid: boolean; references: PromptReferences; warnings: PromptWarning[] } {
  const parsed = PromptReferencesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      references: EMPTY_PROMPT_REFERENCES,
      warnings: parsed.error.issues.map((issue) => ({
        code: "INVALID_REFERENCE",
        field: issue.path.join("."),
        message: issue.message,
        severity: "error",
      })),
    };
  }

  const references = normalizePromptReferences(parsed.data);
  const warnings: PromptWarning[] = [];
  const model: MidjourneyModel = context.parameters.model ?? "8.2";
  const hasImageReferences =
    references.imagePrompts.length > 0 ||
    references.styleReferences.length > 0 ||
    Boolean(references.omniReference);

  if (context.taskType === "video") {
    if (!references.videoStart) {
      addError(warnings, "videoStart", "VIDEO_START_REQUIRED", "视频任务需要一张起始帧图片。");
    }
    if (hasImageReferences) {
      addError(
        warnings,
        "references",
        "VIDEO_REFERENCE_CONFLICT",
        "视频任务不能同时使用普通图片提示、Style Reference 或 Omni Reference。",
      );
    }
    if (references.videoEnd && context.parameters.loop) {
      addError(
        warnings,
        "videoEnd",
        "VIDEO_END_LOOP_CONFLICT",
        "自定义视频结束帧与 Loop 不能同时使用；Loop 会复用起始帧作为结束帧。",
      );
    }
  } else if (references.videoStart || references.videoEnd) {
    addError(
      warnings,
      "references",
      "IMAGE_VIDEO_FRAME_CONFLICT",
      "图像任务不能使用视频起始帧或结束帧。",
    );
  }

  if (references.omniReference && model !== "7") {
    addError(
      warnings,
      "omniReference",
      "OMNI_MODEL_UNSUPPORTED",
      "Omni Reference 目前仅支持 Midjourney V7。",
    );
  }
  if (references.omniReference) {
    if (context.parameters.draft) {
      addError(warnings, "draft", "OMNI_DRAFT_CONFLICT", "Omni Reference 与 Draft 不能同时使用。");
    }
    if (context.parameters.speedMode === "fast") {
      addError(warnings, "speedMode", "OMNI_FAST_CONFLICT", "Omni Reference 与 Fast Mode 不能同时使用。");
    }
    if (context.parameters.quality === 4) {
      addError(warnings, "quality", "OMNI_Q4_CONFLICT", "Omni Reference 与 Quality 4 不能同时使用。");
    }
  }

  if (context.parameters.imageWeight !== undefined && !references.imagePrompts.length) {
    addError(
      warnings,
      "imageWeight",
      "IMAGE_WEIGHT_REFERENCE_REQUIRED",
      "设置 Image Weight 前必须添加普通图片提示。",
    );
  }
  if (context.parameters.styleWeight !== undefined && !references.styleReferences.length) {
    addError(
      warnings,
      "styleWeight",
      "STYLE_WEIGHT_REFERENCE_REQUIRED",
      "设置 Style Weight 前必须添加 Style Reference。",
    );
  }
  if (context.parameters.omniWeight !== undefined && !references.omniReference) {
    addError(
      warnings,
      "omniWeight",
      "OMNI_WEIGHT_REFERENCE_REQUIRED",
      "设置 Omni Weight 前必须添加 Omni Reference。",
    );
  }

  return {
    valid: !warnings.some((warning) => warning.severity === "error"),
    references,
    warnings,
  };
}

export function composePromptWithReferences(
  body: string,
  parameters: PromptParameters,
  references: PromptReferences,
  context: { targetSurface: TargetSurface; taskType: TaskType },
): string {
  const normalized = normalizePromptReferences(references);
  const prefix =
    context.taskType === "video"
      ? normalized.videoStart?.value ?? ""
      : normalized.imagePrompts.map((item) => item.value).join(" ");
  const referenceSuffix = serializeReferenceParameters(normalized, context.taskType);
  const parameterSuffix = serializeParameters(parameters, {
    ...context,
    references: normalized,
  });
  const base = [prefix, body.trim()].filter(Boolean).join(" ");
  return appendParameterSuffix(base, [referenceSuffix, parameterSuffix].filter(Boolean).join(" "));
}

export function serializeReferenceParameters(
  references: PromptReferences,
  taskType: TaskType,
): string {
  if (taskType === "video") {
    return references.videoEnd ? `--end ${references.videoEnd.value}` : "";
  }
  const chunks: string[] = [];
  if (references.styleReferences.length) {
    const values = references.styleReferences.map((item) =>
      item.weight ? `${item.value}::${item.weight}` : item.value,
    );
    chunks.push(`--sref ${values.join(" ")}`);
  }
  if (references.omniReference) {
    chunks.push(`--oref ${references.omniReference.value}`);
  }
  return chunks.join(" ");
}

export function extractReferencesFromPrompt(
  prompt: string,
  current: PromptReferences = EMPTY_PROMPT_REFERENCES,
  taskType: TaskType = "image",
): PromptReferenceExtraction {
  let body = prompt;
  const warnings: PromptWarning[] = [];
  const next: PromptReferences = {
    imagePrompts: [...current.imagePrompts],
    styleReferences: [...current.styleReferences],
    omniReference: current.omniReference,
    videoStart: current.videoStart,
    videoEnd: current.videoEnd,
  };

  body = body.replace(/(?:^|\s)--sref\s+(.+?)(?=\s--[a-z]|$)/gi, (_match, raw: string) => {
    const values = raw.trim().split(/\s+/).filter(Boolean);
    next.styleReferences = values.slice(-10).map((item, order) => {
      const weighted = /^(.*)::(\d+(?:\.\d+)?)$/.exec(item);
      const value = weighted?.[1] ?? item;
      return {
        ...createPromptReference(
          "style_reference",
          value,
          order,
          /^(?:random|\d{1,12})$/i.test(value) ? "code" : "url",
        ),
        weight: weighted ? Number(weighted[2]) : undefined,
      };
    });
    return " ";
  });
  body = body.replace(/(?:^|\s)--oref\s+(\S+)/gi, (_match, value: string) => {
    next.omniReference = createPromptReference("omni_reference", value);
    return " ";
  });
  body = body.replace(/(?:^|\s)--end\s+(\S+)/gi, (_match, value: string) => {
    next.videoEnd = createPromptReference("video_end", value);
    return " ";
  });

  const imageUrls: string[] = [];
  body = body.replace(
    /https:\/\/[^\s,]+\.(?:jpe?g|png|webp|gif)(?:\?[^\s,]*)?/gi,
    (value) => {
      imageUrls.push(value);
      return " ";
    },
  );
  if (imageUrls.length) {
    if (taskType === "video") {
      next.videoStart = createPromptReference("video_start", imageUrls[0]);
      if (imageUrls.length > 1) {
        warnings.push({
          code: "EXTRA_VIDEO_IMAGE_URLS",
          field: "references",
          message: "视频 Prompt 只使用第一张裸图片 URL 作为起始帧，其余地址已忽略。",
          severity: "warning",
        });
      }
    } else {
      const existing = new Set(next.imagePrompts.map((item) => item.value));
      for (const value of imageUrls) {
        if (!existing.has(value) && next.imagePrompts.length < 10) {
          next.imagePrompts.push(
            createPromptReference("image_prompt", value, next.imagePrompts.length),
          );
          existing.add(value);
        }
      }
    }
  }

  const parsed = PromptReferencesSchema.safeParse(next);
  if (!parsed.success) {
    warnings.push(
      ...parsed.error.issues.map((issue) => ({
        code: "INVALID_PASTED_REFERENCE",
        field: issue.path.join("."),
        message: issue.message,
        severity: "error" as const,
      })),
    );
  }
  return {
    body: body.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim(),
    references: parsed.success ? normalizePromptReferences(parsed.data) : current,
    warnings,
  };
}

export function validatePromptConfiguration(
  parameters: PromptParameters,
  references: PromptReferences,
  context: { targetSurface: TargetSurface; taskType: TaskType; allowLegacyModel?: boolean },
): { valid: boolean; parameters: PromptParameters; references: PromptReferences; warnings: PromptWarning[] } {
  const parameterResult = validateParameters(parameters, { ...context, references });
  const referenceResult = validatePromptReferences(references, {
    ...context,
    parameters: parameterResult.parameters,
  });
  const warnings = dedupeWarnings([...parameterResult.warnings, ...referenceResult.warnings]);
  return {
    valid: !warnings.some((warning) => warning.severity === "error"),
    parameters: parameterResult.parameters,
    references: referenceResult.references,
    warnings,
  };
}

function addError(
  warnings: PromptWarning[],
  field: string,
  code: string,
  message: string,
): void {
  warnings.push({ code, field, message, severity: "error" });
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
