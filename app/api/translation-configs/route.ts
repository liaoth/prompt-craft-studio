import { asc, eq } from "drizzle-orm";

import { translationConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import {
  encryptedApiKey,
  encryptedEndpoint,
  publicTranslationConfig,
  resolveTranslationEndpoint,
  translationConfigCreateSchema,
} from "@/lib/server/configs";
import { validateEndpointUrl } from "@/lib/server/endpoints";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const rows = await getDb()
    .select()
    .from(translationConfigs)
    .where(eq(translationConfigs.userId, current.user.id))
    .orderBy(asc(translationConfigs.createdAt));
  return ok({ items: rows.map(publicTranslationConfig) });
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(
    request,
    translationConfigCreateSchema,
    32 * 1024,
  );
  const endpoint = resolveTranslationEndpoint(input);
  if (!(await validateEndpointUrl(endpoint))) {
    throw new ApiError(400, "翻译 API 地址未通过安全检查。", "UNSAFE_ENDPOINT");
  }

  const item = await getDb().transaction(async (tx) => {
    if (input.isActive) {
      await tx
        .update(translationConfigs)
        .set({ isActive: false })
        .where(eq(translationConfigs.userId, current.user.id));
    }
    const [created] = await tx
      .insert(translationConfigs)
      .values({
        userId: current.user.id,
        label: input.label,
        provider: input.provider,
        endpoint: encryptedEndpoint(endpoint),
        credentialEncrypted: encryptedApiKey(input.apiKey),
        isActive: input.isActive,
      })
      .returning();
    return created;
  });
  return ok({ item: publicTranslationConfig(item) }, { status: 201 });
});
