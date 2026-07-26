import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { aiProviderConfigs, translationConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  PROMPT_FIELD_ORDER,
  PROMPT_OUTPUT_MAX_LENGTH,
  PromptBlockSchema,
  PromptFieldsSchema,
  PromptParametersSchema,
  PromptReferencesSchema,
  PromptSnapshotV4Schema,
  TargetSurfaceSchema,
  TaskTypeSchema,
  TranslatedPromptFieldsSchema,
  fieldsToBlocks,
  generateAiPrompt,
  generateRulePrompt,
  parametersWithNegativeBlocks,
  reconcileNegativeBlocks,
  translateText,
  validatePromptConfiguration,
  type PromptFieldKey,
  type PromptWarning,
  type TranslationConfig,
} from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import {
  aiConfigFromRow,
  sharedAiConfig,
  sharedAiTimeoutMs,
  sharedTranslationConfig,
  translationConfigFromRow,
} from "@/lib/server/configs";
import {
  safeProviderFetch,
  validateAiEndpointUrl,
  validateEndpointUrl,
  validateTranslationEndpointUrl,
} from "@/lib/server/endpoints";
import { savePromptHistory } from "@/lib/server/history";
import { RATE_LIMIT_PRESET, enforceRateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

const generateSchema = z.object({
  mode: z.enum(["rule", "ai"]).default("rule"),
  idea: z.string().trim().max(4_000).default(""),
  blocks: z.array(PromptBlockSchema).max(240).optional(),
  fields: PromptFieldsSchema.partial().default({}),
  translatedFields: TranslatedPromptFieldsSchema.default({}),
  custom: z.string().trim().max(4_000).default(""),
  presetIds: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  parameters: PromptParametersSchema.default({}),
  references: PromptReferencesSchema.default({
    imagePrompts: [],
    styleReferences: [],
    omniReference: null,
    videoStart: null,
    videoEnd: null,
  }),
  targetSurface: TargetSurfaceSchema.default("web"),
  taskType: TaskTypeSchema.default("image"),
});

const containsChinese = /[\u3400-\u9fff]/;

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, generateSchema, 256 * 1024);
  const db = getDb();
  enforceRateLimit(rateLimitKey("prompt-generate", current.user.id), {
    ...RATE_LIMIT_PRESET.generate,
  });

  const normalizedInput = reconcileNegativeBlocks(
    input.blocks ??
      fieldsToBlocks(input.fields, input.translatedFields, "user"),
    input.parameters,
  );
  const requestParameters = parametersWithNegativeBlocks(
    normalizedInput.parameters,
    normalizedInput.blocks,
  );
  const configuration = validatePromptConfiguration(
    requestParameters,
    input.references,
    {
      targetSurface: input.targetSurface,
      taskType: input.taskType,
    },
  );
  if (!configuration.valid) {
    const firstError = configuration.warnings.find((item) => item.severity === "error");
    throw new ApiError(
      400,
      firstError?.message ?? "Midjourney 参数校验失败。",
      "INVALID_PARAMETERS",
    );
  }

  let draft;
  if (input.mode === "ai") {
    const [provider] = await db
      .select()
      .from(aiProviderConfigs)
      .where(
        and(
          eq(aiProviderConfigs.userId, current.user.id),
          eq(aiProviderConfigs.isActive, true),
        ),
      )
      .limit(1);
    const config = provider ? aiConfigFromRow(provider) : sharedAiConfig();
    if (!config) {
      throw new ApiError(
        400,
        "自然语言三版本生成需要模型配置。请启用个人模型，或联系站点管理员配置共享模型。",
        "AI_PROVIDER_REQUIRED",
      );
    }
    const idea =
      input.idea ||
      PROMPT_FIELD_ORDER.map((key) => input.fields[key])
        .filter(Boolean)
        .join("，");
    if (!idea) throw new ApiError(400, "请输入中文创意。", "IDEA_REQUIRED");

    draft = await generateAiPrompt({
      config,
      idea,
      fields: input.fields,
      parameters: configuration.parameters,
      references: configuration.references,
      targetSurface: input.targetSurface,
      taskType: input.taskType,
      fetchImpl: safeProviderFetch,
      validateEndpoint:
        provider ? validateEndpointUrl : validateAiEndpointUrl,
      timeoutMs: provider ? 45_000 : (sharedAiTimeoutMs() ?? 45_000),
    });
  } else {
    const [translationRow] = await db
      .select()
      .from(translationConfigs)
      .where(
        and(
          eq(translationConfigs.userId, current.user.id),
          eq(translationConfigs.isActive, true),
        ),
      )
      .limit(1);
    const translationConfig = translationRow
      ? translationConfigFromRow(translationRow)
      : sharedTranslationConfig();
    const translation = await translateFields(
      input.fields,
      input.translatedFields,
      translationConfig,
    );
    const customTranslation = await translateCustom(input.custom, translationConfig);
    const ideaTranslation = await translateCustom(input.idea, translationConfig);
    draft = generateRulePrompt({
      idea: input.idea,
      translatedIdea: ideaTranslation.text,
      blocks: normalizedInput.blocks,
      fields: input.fields,
      translatedFields: translation.translatedFields,
      custom: input.custom,
      translatedCustom: customTranslation.text,
      presetIds: input.presetIds,
      parameters: configuration.parameters,
      references: configuration.references,
      targetSurface: input.targetSurface,
      taskType: input.taskType,
    });
    draft.warnings.push(...translation.warnings);
    if (customTranslation.warning) {
      draft.warnings.push({
        code: "TRANSLATION_FALLBACK",
        message: `自定义词：${customTranslation.warning}`,
        field: "custom",
        severity: "warning",
      });
    }
    if (ideaTranslation.warning) {
      draft.warnings.push({
        code: "TRANSLATION_FALLBACK",
        message: `创意：${ideaTranslation.warning}`,
        field: "idea",
        severity: "warning",
      });
    }
  }

  if (
    draft.variants.some(
      (variant) =>
        variant.promptZh.length > PROMPT_OUTPUT_MAX_LENGTH ||
        variant.promptEn.length > PROMPT_OUTPUT_MAX_LENGTH,
    )
  ) {
    throw new ApiError(
      413,
      `Prompt 超过 ${PROMPT_OUTPUT_MAX_LENGTH} 字符限制。`,
      "PAYLOAD_TOO_LARGE",
    );
  }

  const snapshot = PromptSnapshotV4Schema.parse({
    ...draft,
    input: draft.fields,
    createdAt: new Date().toISOString(),
  });
  const history = await savePromptHistory(current.user.id, snapshot);
  return ok({ draft, historyId: history.id });
});

async function translateCustom(
  custom: string,
  config?: TranslationConfig,
): Promise<{ text?: string; warning?: string }> {
  const value = custom.trim();
  if (!value || !containsChinese.test(value)) return {};
  const result = await translateText({
    text: value,
    sourceLanguage: "zh",
    targetLanguage: "en",
    config,
    sharedLibreTranslateConfig: sharedTranslationConfig(),
    fetchImpl: safeProviderFetch,
    validateEndpoint: validateTranslationEndpointUrl,
    timeoutMs: 30_000,
  });
  return {
    text: result.translated ? result.text : undefined,
    warning: result.warning,
  };
}

async function translateFields(
  fields: Partial<Record<PromptFieldKey, string>>,
  supplied: Partial<Record<PromptFieldKey, string>>,
  config?: TranslationConfig,
) {
  const translatedFields = { ...supplied };
  const warnings: PromptWarning[] = [];
  const keys = PROMPT_FIELD_ORDER.filter((key) => {
    const value = fields[key]?.trim();
    return value && containsChinese.test(value) && !translatedFields[key];
  });
  const results = await Promise.all(
    keys.map(async (key) => ({
      key,
      result: await translateText({
        text: fields[key]!,
        sourceLanguage: "zh",
        targetLanguage: "en",
        config,
        sharedLibreTranslateConfig: sharedTranslationConfig(),
        fetchImpl: safeProviderFetch,
        validateEndpoint: validateTranslationEndpointUrl,
        timeoutMs: 30_000,
      }),
    })),
  );
  for (const { key, result } of results) {
    if (result.translated) translatedFields[key] = result.text;
    if (result.warning) {
      warnings.push({
        code: "TRANSLATION_FALLBACK",
        message: `${key}: ${result.warning}`,
        field: key,
        severity: "warning",
      });
    }
  }
  return { translatedFields, warnings };
}
