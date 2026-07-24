import { asc, eq } from "drizzle-orm";

import { aiProviderConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import {
  encryptedApiKey,
  encryptedEndpoint,
  providerConfigCreateSchema,
  publicProviderConfig,
  resolveAiEndpoint,
} from "@/lib/server/configs";
import { validateEndpointUrl } from "@/lib/server/endpoints";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const rows = await getDb()
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.userId, current.user.id))
    .orderBy(asc(aiProviderConfigs.createdAt));
  return ok({ items: rows.map(publicProviderConfig) });
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(request, providerConfigCreateSchema, 32 * 1024);
  const endpoint = resolveAiEndpoint(input);
  if (!(await validateEndpointUrl(endpoint))) {
    throw new ApiError(400, "模型 API 地址未通过安全检查。", "UNSAFE_ENDPOINT");
  }

  const item = await getDb().transaction(async (tx) => {
    if (input.isActive) {
      await tx
        .update(aiProviderConfigs)
        .set({ isActive: false })
        .where(eq(aiProviderConfigs.userId, current.user.id));
    }
    const [created] = await tx
      .insert(aiProviderConfigs)
      .values({
        userId: current.user.id,
        label: input.label,
        provider: input.provider,
        endpoint: encryptedEndpoint(endpoint),
        model: input.model,
        credentialEncrypted: encryptedApiKey(input.apiKey),
        isActive: input.isActive,
      })
      .returning();
    return created;
  });
  return ok({ item: publicProviderConfig(item) }, { status: 201 });
});
