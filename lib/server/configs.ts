import { z } from "zod";

import type {
  AiProviderConfig,
  TranslationConfig,
} from "@/lib/prompt";
import {
  AiProviderConfigSchema,
  PROVIDER_REGISTRY,
  TRANSLATION_ADAPTERS,
  TranslationConfigSchema,
  resolveProviderEndpoint,
} from "@/lib/prompt";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { ApiError } from "@/lib/server/http";
import { maskEndpoint } from "@/lib/server/endpoints";

export const providerConfigCreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  provider: z.enum([
    "openai",
    "anthropic",
    "gemini",
    "deepseek",
    "qwen",
    "doubao",
    "zhipu",
    "kimi",
    "minimax",
    "custom",
  ]),
  model: z.string().trim().min(1).max(120),
  endpoint: z.url().max(500).optional(),
  apiKey: z.string().trim().min(1).max(8192),
  isActive: z.boolean().default(true),
});

export const providerConfigUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    provider: providerConfigCreateSchema.shape.provider.optional(),
    model: z.string().trim().min(1).max(120).optional(),
    endpoint: z.url().max(500).optional(),
    apiKey: z.string().trim().min(1).max(8192).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const translationConfigCreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  provider: z.enum(["libretranslate", "deepl", "google"]),
  endpoint: z.url().max(500).optional(),
  apiKey: z.string().trim().max(8192).default(""),
  isActive: z.boolean().default(true),
});

export const translationConfigUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    provider: translationConfigCreateSchema.shape.provider.optional(),
    endpoint: z.url().max(500).optional(),
    apiKey: z.string().trim().max(8192).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const midjourneyProviderConfigCreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  provider: z.enum(["discord_webhook", "custom_http"]),
  endpoint: z.url().max(500),
  apiKey: z.string().trim().max(8192).default(""),
  isActive: z.boolean().default(true),
});

export const midjourneyProviderConfigUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    provider: midjourneyProviderConfigCreateSchema.shape.provider.optional(),
    endpoint: z.url().max(500).optional(),
    apiKey: z.string().trim().max(8192).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type ProviderConfigRow = {
  id: string;
  userId: string;
  label: string;
  provider: string;
  model: string;
  endpoint: string;
  credentialEncrypted: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TranslationConfigRow = {
  id: string;
  userId: string;
  label: string;
  provider: string;
  endpoint: string;
  credentialEncrypted: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MidjourneyProviderConfigRow = {
  id: string;
  userId: string;
  label: string;
  provider: string;
  endpoint: string;
  credentialEncrypted: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function encryptedApiKey(apiKey?: string): string {
  if (!apiKey) return "";
  return encryptSecret(JSON.stringify({ apiKey }));
}

export function encryptedEndpoint(endpoint: string): string {
  return encryptSecret(endpoint);
}

export function decryptedEndpoint(stored: string): string {
  if (!stored) return "";
  // Backwards compatibility for rows created before endpoints were encrypted.
  if (!stored.startsWith("v1.")) return stored;
  try {
    return decryptSecret(stored);
  } catch {
    throw new ApiError(500, "Failed to decrypt endpoint", "CREDENTIAL_ERROR");
  }
}

export function decryptedApiKey(encrypted?: string): string {
  if (!encrypted) return "";
  try {
    const payload = JSON.parse(decryptSecret(encrypted)) as unknown;
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof (payload as { apiKey?: unknown }).apiKey !== "string"
    ) {
      throw new Error("invalid");
    }
    return (payload as { apiKey: string }).apiKey;
  } catch {
    throw new ApiError(500, "Failed to decrypt secret", "CREDENTIAL_ERROR");
  }
}

export function publicProviderConfig(row: ProviderConfigRow) {
  const apiKey = decryptedApiKey(row.credentialEncrypted);
  const endpoint = decryptedEndpoint(row.endpoint);
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    endpoint: maskEndpoint(endpoint),
    model: row.model,
    apiKeyMasked: apiKey ? maskSecret(apiKey) : "",
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function publicTranslationConfig(row: TranslationConfigRow) {
  const apiKey = decryptedApiKey(row.credentialEncrypted);
  const endpoint = decryptedEndpoint(row.endpoint);
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    endpoint: maskEndpoint(endpoint),
    apiKeyMasked: apiKey ? maskSecret(apiKey) : "",
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function publicMidjourneyConfig(row: MidjourneyProviderConfigRow) {
  const apiKey = decryptedApiKey(row.credentialEncrypted);
  const endpoint = decryptedEndpoint(row.endpoint);
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    endpoint: maskEndpoint(endpoint),
    apiKeyMasked: apiKey ? maskSecret(apiKey) : "",
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function aiConfigFromRow(row: ProviderConfigRow): AiProviderConfig {
  return AiProviderConfigSchema.parse({
    provider: row.provider,
    apiKey: decryptedApiKey(row.credentialEncrypted),
    model: row.model,
    endpoint: decryptedEndpoint(row.endpoint),
  });
}

export function translationConfigFromRow(
  row: TranslationConfigRow,
): TranslationConfig {
  const apiKey = decryptedApiKey(row.credentialEncrypted);
  return TranslationConfigSchema.parse({
    provider: row.provider,
    endpoint: decryptedEndpoint(row.endpoint),
    ...(apiKey ? { apiKey } : {}),
  });
}

export function resolveAiEndpoint(input: {
  provider: keyof typeof PROVIDER_REGISTRY;
  model: string;
  endpoint?: string;
  apiKey: string;
}): string {
  return resolveProviderEndpoint(input);
}

export function resolveMidjourneyEndpoint(input: {
  provider: string;
  endpoint?: string;
}): string {
  return input.endpoint ?? "";
}

export function resolveTranslationEndpoint(input: {
  provider: keyof typeof TRANSLATION_ADAPTERS;
  endpoint?: string;
}): string {
  return input.endpoint ?? TRANSLATION_ADAPTERS[input.provider].defaultEndpoint;
}

export function sharedLibreTranslateEndpoint(): string | undefined {
  return (
    process.env.SHARED_LIBRETRANSLATE_URL?.trim() ||
    process.env.LIBRETRANSLATE_URL?.trim() ||
    undefined
  );
}

export function sharedTranslationConfig(): TranslationConfig | undefined {
  const endpoint = sharedLibreTranslateEndpoint();
  if (!endpoint) return undefined;
  const apiKey = process.env.SHARED_LIBRETRANSLATE_API_KEY?.trim();
  const chineseLanguageCode =
    process.env.SHARED_LIBRETRANSLATE_CHINESE_LANGUAGE_CODE?.trim();
  return TranslationConfigSchema.parse({
    provider: "libretranslate",
    endpoint,
    ...(apiKey ? { apiKey } : {}),
    ...(chineseLanguageCode ? { chineseLanguageCode } : {}),
  });
}

/**
 * Site-wide AI fallback. It is intentionally returned only to server code;
 * callers must never serialize this object because it contains the raw key.
 */
export function sharedAiConfig(): AiProviderConfig | undefined {
  const provider = process.env.SITE_AI_PROVIDER?.trim();
  const model = process.env.SITE_AI_MODEL?.trim();
  const apiKey = process.env.SITE_AI_API_KEY?.trim();
  const endpoint = process.env.SITE_AI_ENDPOINT?.trim();
  if (!provider || !model || !apiKey) return undefined;
  return AiProviderConfigSchema.parse({
    provider,
    model,
    apiKey,
    ...(endpoint ? { endpoint } : {}),
  });
}

export function sharedAiTimeoutMs(): number | undefined {
  const raw = process.env.SITE_AI_TIMEOUT_MS?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 120_000) {
    throw new ApiError(
      500,
      "SITE_AI_TIMEOUT_MS must be an integer between 1 and 120000.",
      "INVALID_SITE_CONFIG",
    );
  }
  return value;
}
