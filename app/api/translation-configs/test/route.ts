import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { translationConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { translateText } from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import {
  resolveTranslationEndpoint,
  translationConfigCreateSchema,
  translationConfigFromRow,
} from "@/lib/server/configs";
import {
  safeProviderFetch,
  validateTranslationEndpointUrl,
} from "@/lib/server/endpoints";
import {
  RATE_LIMIT_PRESET,
  enforceRateLimit,
  rateLimitKey,
} from "@/lib/server/rate-limit";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

const testSchema = z.union([
  z.object({ id: z.uuid() }),
  translationConfigCreateSchema.omit({ label: true, isActive: true }),
]);

export const POST = route(async (request) => {
  const current = await requireSession(request);
  enforceRateLimit(
    rateLimitKey("translation-config-test", current.user.id),
    RATE_LIMIT_PRESET.test,
  );
  const input = await readJson(request, testSchema, 32 * 1024);
  let config;
  let allowInsecureRemote = false;
  if ("id" in input) {
    const [row] = await getDb()
      .select()
      .from(translationConfigs)
      .where(
        and(
          eq(translationConfigs.id, input.id),
          eq(translationConfigs.userId, current.user.id),
        ),
      )
      .limit(1);
    if (!row) throw new ApiError(404, "翻译配置不存在。", "NOT_FOUND");
    config = translationConfigFromRow(row);
    allowInsecureRemote = true;
  } else {
    config = {
      provider: input.provider,
      endpoint: resolveTranslationEndpoint(input),
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    };
  }

  const result = await translateText({
    text: "creative studio",
    sourceLanguage: "en",
    targetLanguage: "zh",
    config,
    fetchImpl: safeProviderFetch,
    validateEndpoint: (endpoint) =>
      validateTranslationEndpointUrl(endpoint, { allowInsecureRemote }),
    timeoutMs: 20_000,
  });
  if (!result.translated) {
    throw new ApiError(502, "翻译服务连接测试失败。", "PROVIDER_ERROR");
  }
  return ok({ success: true, message: "翻译服务连接测试成功。" });
});
