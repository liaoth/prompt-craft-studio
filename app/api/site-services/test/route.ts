import { z } from "zod";

import {
  testAiProviderConnection,
  translateText,
} from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import {
  sharedAiConfig,
  sharedAiTimeoutMs,
  sharedTranslationConfig,
} from "@/lib/server/configs";
import {
  safeProviderFetch,
  validateAiEndpointUrl,
  validateTranslationEndpointUrl,
} from "@/lib/server/endpoints";
import {
  RATE_LIMIT_PRESET,
  enforceRateLimit,
  rateLimitKey,
} from "@/lib/server/rate-limit";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

const testSchema = z.object({
  service: z.enum(["ai", "translation"]),
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  enforceRateLimit(
    rateLimitKey("site-service-test", current.user.id),
    RATE_LIMIT_PRESET.test,
  );
  const input = await readJson(request, testSchema, 4 * 1024);
  const startedAt = Date.now();

  if (input.service === "ai") {
    const config = sharedAiConfig();
    if (!config) {
      throw new ApiError(
        400,
        "站点共享 AI 尚未配置。",
        "AI_PROVIDER_REQUIRED",
      );
    }
    await testAiProviderConnection({
      config,
      fetchImpl: safeProviderFetch,
      validateEndpoint: validateAiEndpointUrl,
      timeoutMs: sharedAiTimeoutMs() ?? 45_000,
    });
    return ok({
      success: true,
      service: "ai",
      latencyMs: Date.now() - startedAt,
      message: "共享 AI 连接和 JSON 输出正常。",
    });
  }

  const config = sharedTranslationConfig();
  if (!config) {
    throw new ApiError(
      400,
      "站点共享翻译尚未配置。",
      "TRANSLATION_CONFIG_REQUIRED",
    );
  }
  const result = await translateText({
    text: "服务器配置测试",
    sourceLanguage: "zh",
    targetLanguage: "en",
    config,
    fetchImpl: safeProviderFetch,
    validateEndpoint: validateTranslationEndpointUrl,
    timeoutMs: 30_000,
  });
  if (!result.translated) {
    throw new ApiError(
      502,
      "共享翻译连接测试失败。",
      "PROVIDER_ERROR",
    );
  }
  return ok({
    success: true,
    service: "translation",
    latencyMs: Date.now() - startedAt,
    message: "共享翻译连接正常。",
  });
});
