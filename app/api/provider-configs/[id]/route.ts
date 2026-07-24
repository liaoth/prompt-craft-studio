import { and, eq } from "drizzle-orm";

import { aiProviderConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import {
  decryptedApiKey,
  decryptedEndpoint,
  encryptedApiKey,
  encryptedEndpoint,
  providerConfigUpdateSchema,
  publicProviderConfig,
  resolveAiEndpoint,
} from "@/lib/server/configs";
import { validateEndpointUrl } from "@/lib/server/endpoints";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { idSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const input = await readJson(request, providerConfigUpdateSchema, 32 * 1024);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(aiProviderConfigs)
    .where(
      and(
        eq(aiProviderConfigs.id, id),
        eq(aiProviderConfigs.userId, current.user.id),
      ),
    )
    .limit(1);
  if (!existing) throw new ApiError(404, "模型配置不存在。", "NOT_FOUND");

  const endpoint = resolveAiEndpoint({
    provider: input.provider ?? (existing.provider as never),
    model: input.model ?? existing.model,
    endpoint:
      input.endpoint ??
      (input.provider && input.provider !== existing.provider
        ? undefined
        : decryptedEndpoint(existing.endpoint)),
    apiKey: input.apiKey ?? decryptedApiKey(existing.credentialEncrypted),
  });
  if (!(await validateEndpointUrl(endpoint))) {
    throw new ApiError(400, "模型 API 地址未通过安全检查。", "UNSAFE_ENDPOINT");
  }

  const item = await db.transaction(async (tx) => {
    if (input.isActive) {
      await tx
        .update(aiProviderConfigs)
        .set({ isActive: false })
        .where(eq(aiProviderConfigs.userId, current.user.id));
    }
    const [updated] = await tx
      .update(aiProviderConfigs)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        endpoint: encryptedEndpoint(endpoint),
        ...(input.apiKey !== undefined
          ? { credentialEncrypted: encryptedApiKey(input.apiKey) }
          : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive }
          : {}),
      })
      .where(
        and(
          eq(aiProviderConfigs.id, id),
          eq(aiProviderConfigs.userId, current.user.id),
        ),
      )
      .returning();
    return updated;
  });
  return ok({ item: publicProviderConfig(item) });
});

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(aiProviderConfigs)
    .where(
      and(
        eq(aiProviderConfigs.id, id),
        eq(aiProviderConfigs.userId, current.user.id),
      ),
    )
    .returning({ id: aiProviderConfigs.id });
  if (!deleted) throw new ApiError(404, "模型配置不存在。", "NOT_FOUND");
  return ok({ success: true });
});
