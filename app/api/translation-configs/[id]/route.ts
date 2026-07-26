import { and, eq } from "drizzle-orm";

import { translationConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import {
  decryptedEndpoint,
  encryptedApiKey,
  encryptedEndpoint,
  publicTranslationConfig,
  resolveTranslationEndpoint,
  translationConfigUpdateSchema,
} from "@/lib/server/configs";
import { validateEndpointUrl } from "@/lib/server/endpoints";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { idSchema } from "@/lib/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const input = await readJson(
    request,
    translationConfigUpdateSchema,
    32 * 1024,
  );
  const db = getDb();
  const [existing] = await db
    .select()
    .from(translationConfigs)
    .where(
      and(
        eq(translationConfigs.id, id),
        eq(translationConfigs.userId, current.user.id),
      ),
    )
    .limit(1);
  if (!existing) throw new ApiError(404, "翻译配置不存在。", "NOT_FOUND");

  const endpoint = resolveTranslationEndpoint({
    provider: input.provider ?? (existing.provider as never),
    endpoint:
      input.endpoint ??
      (input.provider && input.provider !== existing.provider
        ? undefined
      : decryptedEndpoint(existing.endpoint)),
  });
  const usesStoredEndpoint =
    input.endpoint === undefined &&
    input.provider === undefined &&
    endpoint === decryptedEndpoint(existing.endpoint);
  if (
    !(await validateEndpointUrl(endpoint, {
      allowInsecureRemote: usesStoredEndpoint,
    }))
  ) {
    throw new ApiError(400, "翻译 API 地址未通过安全检查。", "UNSAFE_ENDPOINT");
  }

  const item = await db.transaction(async (tx) => {
    if (input.isActive) {
      await tx
        .update(translationConfigs)
        .set({ isActive: false })
        .where(eq(translationConfigs.userId, current.user.id));
    }
    const [updated] = await tx
      .update(translationConfigs)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
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
          eq(translationConfigs.id, id),
          eq(translationConfigs.userId, current.user.id),
        ),
      )
      .returning();
    return updated;
  });
  return ok({ item: publicTranslationConfig(item) });
});

export const DELETE = route<RouteContext>(async (request, context) => {
  const current = await requireSession(request);
  const { id: rawId } = await context.params;
  const id = idSchema.parse(rawId);
  const [deleted] = await getDb()
    .delete(translationConfigs)
    .where(
      and(
        eq(translationConfigs.id, id),
        eq(translationConfigs.userId, current.user.id),
      ),
    )
    .returning({ id: translationConfigs.id });
  if (!deleted) throw new ApiError(404, "翻译配置不存在。", "NOT_FOUND");
  return ok({ success: true });
});
