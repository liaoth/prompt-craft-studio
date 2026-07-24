import { and, count, desc, eq } from "drizzle-orm";

import { midjourneyProviderConfigs, midjourneySubmissions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/server/auth";
import { decryptedApiKey, decryptedEndpoint } from "@/lib/server/configs";
import { validateMidjourneyEndpointUrl } from "@/lib/server/endpoints";
import { ApiError, ok, pagination, readJson, route } from "@/lib/server/http";
import {
  sendToMidjourney,
  toMidjourneySubmissionHash,
} from "@/lib/server/midjourney";
import {
  RATE_LIMIT_PRESET,
  enforceRateLimit,
  rateLimitKey,
} from "@/lib/server/rate-limit";
import { midjourneySubmitSchema } from "@/lib/server/validation";

export const POST = route(async (request) => {
  const current = await requireSession(request);
  enforceRateLimit(
    rateLimitKey("midjourney-submit", current.user.id),
    RATE_LIMIT_PRESET.submission,
  );
  const input = await readJson(request, midjourneySubmitSchema, 128 * 1024);
  const prompt = (input.promptEn || input.promptZh).trim();
  if (!prompt) {
    throw new ApiError(
      400,
      "请先生成 Prompt 内容后再推送。",
      "INVALID_PAYLOAD",
    );
  }

  const db = getDb();
  const [provider] = await db
    .select()
    .from(midjourneyProviderConfigs)
    .where(
      and(
        eq(midjourneyProviderConfigs.userId, current.user.id),
        eq(midjourneyProviderConfigs.isActive, true),
      ),
    )
    .limit(1);
  if (!provider) {
    throw new ApiError(
      400,
      "请先配置并启用一个推送入口。",
      "MIDJOURNEY_CONFIG_REQUIRED",
    );
  }

  const endpoint = decryptedEndpoint(provider.endpoint).trim();
  if (
    !(await validateMidjourneyEndpointUrl(endpoint, {
      resolveDns: true,
    }))
  ) {
    throw new ApiError(
      400,
      "推送地址未通过安全检查。",
      "UNSAFE_ENDPOINT",
    );
  }

  const contentHash = toMidjourneySubmissionHash({
    promptZh: input.promptZh,
    promptEn: input.promptEn,
    source: input.source,
  });
  const snapshot = {
    ...(input.snapshot ?? {}),
    promptZh: input.promptZh,
    promptEn: input.promptEn,
    source: input.source,
  };

  const [existing] = await db
    .select({
      id: midjourneySubmissions.id,
      status: midjourneySubmissions.status,
    })
    .from(midjourneySubmissions)
    .where(
      and(
        eq(midjourneySubmissions.userId, current.user.id),
        eq(midjourneySubmissions.contentHash, contentHash),
      ),
    )
    .limit(1);

  if (existing?.status === "sent" || existing?.status === "pending") {
    return ok({
      submissionId: existing.id,
      status: existing.status,
      details:
        existing.status === "sent"
          ? "该 Prompt 已投递，本次未重复发送。"
          : "相同 Prompt 正在投递，本次未重复发送。",
    });
  }

  const [inserted] = await db
    .insert(midjourneySubmissions)
    .values({
      userId: current.user.id,
      providerConfigId: provider.id,
      contentHash,
      promptZh: input.promptZh,
      promptEn: input.promptEn,
      status: "pending",
      source: input.source,
      snapshot,
    })
    .onConflictDoNothing()
    .returning({ id: midjourneySubmissions.id });

  const submissionId = inserted?.id ?? existing?.id;
  if (!submissionId) {
    const [concurrent] = await db
      .select({
        id: midjourneySubmissions.id,
        status: midjourneySubmissions.status,
      })
      .from(midjourneySubmissions)
      .where(
        and(
          eq(midjourneySubmissions.userId, current.user.id),
          eq(midjourneySubmissions.contentHash, contentHash),
        ),
      )
      .limit(1);
    if (concurrent) {
      return ok({
        submissionId: concurrent.id,
        status: concurrent.status,
        details: "相同 Prompt 已由另一请求处理，本次未重复发送。",
      });
    }
    throw new ApiError(500, "提交记录创建失败。", "SUBMISSION_INTERNAL");
  }

  if (!inserted && existing?.status === "failed") {
    await db
      .update(midjourneySubmissions)
      .set({
        providerConfigId: provider.id,
        promptZh: input.promptZh,
        promptEn: input.promptEn,
        status: "pending",
        errorMessage: null,
        providerResponse: null,
        source: input.source,
        snapshot,
      })
      .where(
        and(
          eq(midjourneySubmissions.id, submissionId),
          eq(midjourneySubmissions.userId, current.user.id),
        ),
      );
  }

  try {
    const result = await sendToMidjourney({
      provider: provider.provider as "discord_webhook" | "custom_http",
      endpoint,
      credential: provider.credentialEncrypted
        ? decryptedApiKey(provider.credentialEncrypted)
        : undefined,
      prompt,
      source: input.source,
      snapshot,
      timeoutMs: 30_000,
    });

    await db
      .update(midjourneySubmissions)
      .set({
        status: result.status,
        errorMessage: null,
        providerResponse: result.response as Record<string, unknown>,
      })
      .where(
        and(
          eq(midjourneySubmissions.id, submissionId),
          eq(midjourneySubmissions.userId, current.user.id),
        ),
      );

    return ok({
      submissionId,
      status: result.status,
      details: result.details,
    });
  } catch {
    await db
      .update(midjourneySubmissions)
      .set({
        status: "failed",
        errorMessage: "配置入口推送失败，请检查端点和凭据。",
      })
      .where(
        and(
          eq(midjourneySubmissions.id, submissionId),
          eq(midjourneySubmissions.userId, current.user.id),
        ),
      );
    throw new ApiError(
      502,
      "配置入口推送失败，请检查端点和凭据。",
      "SUBMIT_FAILED",
    );
  }
});

export const GET = route(async (request) => {
  const current = await requireSession(request);
  const db = getDb();
  const { page, limit, offset } = pagination(request, { page: 1, limit: 10 });
  const [items, [summary]] = await Promise.all([
    db
      .select({
        id: midjourneySubmissions.id,
        promptZh: midjourneySubmissions.promptZh,
        promptEn: midjourneySubmissions.promptEn,
        status: midjourneySubmissions.status,
        errorMessage: midjourneySubmissions.errorMessage,
        source: midjourneySubmissions.source,
        createdAt: midjourneySubmissions.createdAt,
        updatedAt: midjourneySubmissions.updatedAt,
      })
      .from(midjourneySubmissions)
      .where(eq(midjourneySubmissions.userId, current.user.id))
      .orderBy(
        desc(midjourneySubmissions.updatedAt),
        desc(midjourneySubmissions.id),
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(midjourneySubmissions)
      .where(eq(midjourneySubmissions.userId, current.user.id)),
  ]);

  const total = Number(summary?.total ?? 0);
  return ok({ items, total, page, limit, pages: Math.ceil(total / limit) });
});
