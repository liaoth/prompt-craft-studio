import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { midjourneyProviderConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import {
  decryptedApiKey,
  decryptedEndpoint,
  midjourneyProviderConfigCreateSchema,
  resolveMidjourneyEndpoint,
} from "@/lib/server/configs";
import { sendToMidjourney } from "@/lib/server/midjourney";
import {
  safeProviderFetch,
  validateMidjourneyEndpointUrl,
} from "@/lib/server/endpoints";
import {
  RATE_LIMIT_PRESET,
  enforceRateLimit,
  rateLimitKey,
} from "@/lib/server/rate-limit";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

const testSchema = z.union([
  z.object({ id: z.uuid() }),
  midjourneyProviderConfigCreateSchema.pick({
    provider: true,
    endpoint: true,
    apiKey: true,
  }),
]);

export const POST = route(async (request) => {
  const current = await requireSession(request);
  enforceRateLimit(
    rateLimitKey("midjourney-config-test", current.user.id),
    RATE_LIMIT_PRESET.test,
  );
  const input = await readJson(request, testSchema, 32 * 1024);

  let provider: "discord_webhook" | "custom_http";
  let endpoint: string;
  let credential = "";

  if ("id" in input) {
    const [existing] = await getDb()
      .select()
      .from(midjourneyProviderConfigs)
      .where(
        and(
          eq(midjourneyProviderConfigs.id, input.id),
          eq(midjourneyProviderConfigs.userId, current.user.id),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new ApiError(404, "Midjourney config not found", "NOT_FOUND");
    }
    provider = existing.provider as "discord_webhook" | "custom_http";
    endpoint = resolveMidjourneyEndpoint({
      provider: existing.provider,
      endpoint: decryptedEndpoint(existing.endpoint),
    });
    credential = decryptedApiKey(existing.credentialEncrypted);
  } else {
    provider = input.provider;
    endpoint = resolveMidjourneyEndpoint({
      provider: input.provider,
      endpoint: input.endpoint,
    });
    credential = input.apiKey;
  }

  if (!endpoint) {
    throw new ApiError(400, "Invalid Midjourney config payload", "INVALID_CONFIG");
  }
  if (!(await validateMidjourneyEndpointUrl(endpoint, { resolveDns: true }))) {
    throw new ApiError(400, "Midjourney submit endpoint rejected by security check", "UNSAFE_ENDPOINT");
  }

  const result = await sendToMidjourney({
    provider,
    endpoint,
    credential: credential.trim() || undefined,
    prompt: "Midjourney direct submit test",
    source: "rule",
    fetchImpl: safeProviderFetch,
    timeoutMs: 20_000,
  });

  return ok({
    success: true,
    status: result.status,
    details: result.details,
  });
});
