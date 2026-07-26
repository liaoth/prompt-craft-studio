import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { aiProviderConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { generateAiPrompt } from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import {
  aiConfigFromRow,
  providerConfigFieldsSchema,
  resolveAiEndpoint,
} from "@/lib/server/configs";
import {
  safeProviderFetch,
  validateEndpointUrl,
} from "@/lib/server/endpoints";
import {
  RATE_LIMIT_PRESET,
  enforceRateLimit,
  rateLimitKey,
} from "@/lib/server/rate-limit";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

const testSchema = z.union([
  z.object({ id: z.uuid() }),
  providerConfigFieldsSchema,
]);

export const POST = route(async (request) => {
  const current = await requireSession(request);
  enforceRateLimit(
    rateLimitKey("provider-config-test", current.user.id),
    RATE_LIMIT_PRESET.test,
  );
  const input = await readJson(request, testSchema, 32 * 1024);
  let config;
  if ("id" in input) {
    const [row] = await getDb()
      .select()
      .from(aiProviderConfigs)
      .where(
        and(
          eq(aiProviderConfigs.id, input.id),
          eq(aiProviderConfigs.userId, current.user.id),
        ),
      )
      .limit(1);
    if (!row) throw new ApiError(404, "模型配置不存在。", "NOT_FOUND");
    config = aiConfigFromRow(row);
  } else {
    const endpoint = resolveAiEndpoint(input);
    config = { ...input, endpoint };
  }

  await generateAiPrompt({
    config,
    idea: "极简红色圆形图标",
    fetchImpl: safeProviderFetch,
    validateEndpoint: validateEndpointUrl,
    timeoutMs: 20_000,
  });
  return ok({ success: true, message: "连接和结构化输出测试成功。" });
});
