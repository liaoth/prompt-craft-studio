import { and, eq } from "drizzle-orm";

import { midjourneyProviderConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import {
  decryptedEndpoint,
  encryptedApiKey,
  encryptedEndpoint,
  publicMidjourneyConfig,
  midjourneyProviderConfigUpdateSchema,
  resolveMidjourneyEndpoint,
} from "@/lib/server/configs";
import { validateMidjourneyEndpointUrl } from "@/lib/server/endpoints";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { idSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const input = await readJson(request, midjourneyProviderConfigUpdateSchema, 32 * 1024);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(midjourneyProviderConfigs)
    .where(
      and(
        eq(midjourneyProviderConfigs.id, id),
        eq(midjourneyProviderConfigs.userId, current.user.id),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "Midjourney 配置不存在", "NOT_FOUND");
  }

  const endpoint = resolveMidjourneyEndpoint({
    provider: input.provider ?? existing.provider,
    endpoint: input.endpoint ?? decryptedEndpoint(existing.endpoint),
  });
  if (!(await validateMidjourneyEndpointUrl(endpoint))) {
    throw new ApiError(400, "Midjourney 提交地址未通过安全检查", "UNSAFE_ENDPOINT");
  }

  const item = await db.transaction(async (tx) => {
    if (input.isActive) {
      await tx
        .update(midjourneyProviderConfigs)
        .set({ isActive: false })
        .where(eq(midjourneyProviderConfigs.userId, current.user.id));
    }
    const [updated] = await tx
      .update(midjourneyProviderConfigs)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        endpoint: encryptedEndpoint(endpoint),
        ...(input.apiKey !== undefined
          ? { credentialEncrypted: encryptedApiKey(input.apiKey) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(
        and(
          eq(midjourneyProviderConfigs.id, id),
          eq(midjourneyProviderConfigs.userId, current.user.id),
        ),
      )
      .returning();
    return updated;
  });

  return ok({ item: publicMidjourneyConfig(item) });
});

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(midjourneyProviderConfigs)
    .where(
      and(
        eq(midjourneyProviderConfigs.id, id),
        eq(midjourneyProviderConfigs.userId, current.user.id),
      ),
    )
    .returning({ id: midjourneyProviderConfigs.id });

  if (!deleted) {
    throw new ApiError(404, "Midjourney 配置不存在", "NOT_FOUND");
  }

  return ok({ success: true });
});
