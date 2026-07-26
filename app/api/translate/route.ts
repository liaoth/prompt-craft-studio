import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { translationConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { translateText } from "@/lib/prompt";
import { requireSession } from "@/lib/server/auth";
import { translationConfigFromRow } from "@/lib/server/configs";
import {
  safeProviderFetch,
  validateTranslationEndpointUrl,
} from "@/lib/server/endpoints";
import {
  RATE_LIMIT_PRESET,
  enforceRateLimit,
  rateLimitKey,
} from "@/lib/server/rate-limit";
import { ok, readJson, route } from "@/lib/server/http";

const translateSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  sourceLanguage: z.string().trim().min(2).max(16).default("auto"),
  targetLanguage: z.string().trim().min(2).max(16).default("en"),
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  enforceRateLimit(
    rateLimitKey("translate", current.user.id),
    RATE_LIMIT_PRESET.translate,
  );
  const input = await readJson(request, translateSchema, 64 * 1024);
  const [active] = await getDb()
    .select()
    .from(translationConfigs)
    .where(
      and(
        eq(translationConfigs.userId, current.user.id),
        eq(translationConfigs.isActive, true),
      ),
    )
    .limit(1);

  const result = await translateText({
    ...input,
    config: active ? translationConfigFromRow(active) : undefined,
    fetchImpl: safeProviderFetch,
    validateEndpoint: (endpoint) =>
      validateTranslationEndpointUrl(endpoint, { allowInsecureRemote: true }),
    timeoutMs: 30_000,
  });
  return ok(result);
});
