import { asc, eq } from "drizzle-orm";

import { midjourneyProviderConfigs } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import {
  encryptedApiKey,
  encryptedEndpoint,
  midjourneyProviderConfigCreateSchema,
  publicMidjourneyConfig,
  resolveMidjourneyEndpoint,
} from "@/lib/server/configs";
import { validateMidjourneyEndpointUrl } from "@/lib/server/endpoints";
import { ApiError, ok, readJson, route } from "@/lib/server/http";

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const rows = await getDb()
    .select()
    .from(midjourneyProviderConfigs)
    .where(eq(midjourneyProviderConfigs.userId, current.user.id))
    .orderBy(asc(midjourneyProviderConfigs.createdAt));
  return ok({ items: rows.map(publicMidjourneyConfig) });
});

export const POST = route(async (request) => {
  const current = await requireSession(request);
  const input = await readJson(
    request,
    midjourneyProviderConfigCreateSchema,
    32 * 1024,
  );
  const endpoint = resolveMidjourneyEndpoint(input);
  if (!(await validateMidjourneyEndpointUrl(endpoint))) {
    throw new ApiError(400, "Midjourney 提交地址未通过安全检查", "UNSAFE_ENDPOINT");
  }

  const item = await getDb().transaction(async (tx) => {
    if (input.isActive) {
      await tx
        .update(midjourneyProviderConfigs)
        .set({ isActive: false })
        .where(eq(midjourneyProviderConfigs.userId, current.user.id));
    }
    const [created] = await tx
      .insert(midjourneyProviderConfigs)
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
  return ok({ item: publicMidjourneyConfig(item) }, { status: 201 });
});
