import { z } from "zod";
import type { EndpointValidator } from "./providers";
import { readLimitedResponseText } from "../server/endpoints";

export const TRANSLATION_PROVIDER_IDS = ["libretranslate", "deepl", "google"] as const;
export const TranslationProviderIdSchema = z.enum(TRANSLATION_PROVIDER_IDS);
export type TranslationProviderId = z.infer<typeof TranslationProviderIdSchema>;

export const TranslationConfigSchema = z
  .object({
    provider: TranslationProviderIdSchema,
    apiKey: z.string().max(8_192).optional(),
    endpoint: z.url().optional(),
    chineseLanguageCode: z.string().trim().min(2).max(16).optional(),
  })
  .strict();

export type TranslationConfig = z.infer<typeof TranslationConfigSchema>;

export interface TranslationResult {
  text: string;
  translated: boolean;
  provider?: TranslationProviderId;
  warning?: string;
}

export interface TranslateTextInput {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  config?: TranslationConfig;
  sharedLibreTranslateConfig?: TranslationConfig;
  sharedLibreTranslateEndpoint?: string;
  fetchImpl?: typeof fetch;
  validateEndpoint?: EndpointValidator;
  timeoutMs?: number;
}

interface AdapterInput {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  config: TranslationConfig;
  endpoint: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}

interface TranslationAdapter {
  defaultEndpoint: string;
  translate(input: AdapterInput): Promise<string>;
}

export const TRANSLATION_ADAPTERS: Readonly<
  Record<TranslationProviderId, TranslationAdapter>
> = {
  libretranslate: {
    defaultEndpoint: "https://libretranslate.com/translate",
    async translate(input) {
      const response = await request(input, {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          q: input.text,
          source: normalizeLibreLanguage(
            input.sourceLanguage,
            input.config.chineseLanguageCode,
          ),
          target: normalizeLibreLanguage(
            input.targetLanguage,
            input.config.chineseLanguageCode,
          ),
          format: "text",
          ...(input.config.apiKey ? { api_key: input.config.apiKey } : {}),
        }),
      });
      const translatedText = readNestedString(response, ["translatedText"]);
      if (!translatedText) throw new TranslationAdapterError("翻译响应缺少 translatedText。");
      return translatedText;
    },
  },
  deepl: {
    defaultEndpoint: "https://api-free.deepl.com/v2/translate",
    async translate(input) {
      if (!input.config.apiKey) throw new TranslationAdapterError("DeepL 缺少 API Key。");
      const response = await request(input, {
        headers: {
          "content-type": "application/json",
          authorization: `DeepL-Auth-Key ${input.config.apiKey}`,
        },
        body: JSON.stringify({
          text: [input.text],
          source_lang: normalizeDeepLLanguage(input.sourceLanguage),
          target_lang: normalizeDeepLLanguage(input.targetLanguage),
        }),
      });
      if (!isRecord(response) || !Array.isArray(response.translations)) {
        throw new TranslationAdapterError("DeepL 翻译响应格式无效。");
      }
      const first = response.translations[0];
      if (!isRecord(first) || typeof first.text !== "string") {
        throw new TranslationAdapterError("DeepL 翻译响应缺少文本。");
      }
      return first.text;
    },
  },
  google: {
    defaultEndpoint: "https://translation.googleapis.com/language/translate/v2",
    async translate(input) {
      if (!input.config.apiKey) throw new TranslationAdapterError("Google 翻译缺少 API Key。");
      const response = await request(input, {
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": input.config.apiKey,
        },
        body: JSON.stringify({
          q: input.text,
          source: input.sourceLanguage === "auto" ? undefined : input.sourceLanguage,
          target: input.targetLanguage,
          format: "text",
        }),
      });
      const translatedText = readNestedString(response, [
        "data",
        "translations",
        "0",
        "translatedText",
      ]);
      if (!translatedText) throw new TranslationAdapterError("Google 翻译响应缺少文本。");
      return translatedText;
    },
  },
};

export async function translateText(input: TranslateTextInput): Promise<TranslationResult> {
  const text = input.text.trim();
  if (!text) return { text: "", translated: false };

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const attempts: TranslationConfig[] = [];
  const configResult = input.config
    ? TranslationConfigSchema.safeParse(input.config)
    : undefined;

  if (configResult?.success) attempts.push(configResult.data);
  if (
    input.sharedLibreTranslateConfig ||
    input.sharedLibreTranslateEndpoint
  ) {
    const shared = TranslationConfigSchema.safeParse(
      input.sharedLibreTranslateConfig ?? {
        provider: "libretranslate",
        endpoint: input.sharedLibreTranslateEndpoint,
      },
    );
    if (shared.success && !isSameAttempt(attempts[0], shared.data)) attempts.push(shared.data);
  }

  if (attempts.length === 0) {
    return {
      text,
      translated: false,
      warning: input.config
        ? "翻译配置无效，已保留原文。"
        : "未配置翻译服务，已保留原文。",
    };
  }

  const failures: string[] = [];
  for (const config of attempts) {
    const adapter = TRANSLATION_ADAPTERS[config.provider];
    const endpoint = config.endpoint ?? adapter.defaultEndpoint;
    if (input.validateEndpoint && !(await input.validateEndpoint(endpoint))) {
      failures.push(`${config.provider} 地址未通过安全检查`);
      continue;
    }

    try {
      const translated = await adapter.translate({
        text,
        sourceLanguage: input.sourceLanguage ?? "auto",
        targetLanguage: input.targetLanguage,
        config,
        endpoint,
        fetchImpl,
        timeoutMs,
      });
      return { text: translated, translated: true, provider: config.provider };
    } catch {
      failures.push(`${config.provider} 请求失败`);
    }
  }

  return {
    text,
    translated: false,
    warning: `翻译失败，已保留原文（${failures.join("；")}）。`,
  };
}

class TranslationAdapterError extends Error {}

async function request(
  input: AdapterInput,
  requestInit: Pick<RequestInit, "headers" | "body">,
): Promise<unknown> {
  let response: Response;
  try {
    response = await input.fetchImpl(input.endpoint, {
      method: "POST",
      ...requestInit,
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch {
    throw new TranslationAdapterError("无法连接翻译服务。");
  }
  if (!response.ok) {
    throw new TranslationAdapterError(`翻译服务返回 HTTP ${response.status}。`);
  }
  try {
    const responseText = await readLimitedResponseText(response);
    return responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new TranslationAdapterError("翻译服务返回了无效 JSON。");
  }
}

function readNestedString(value: unknown, path: readonly string[]): string | undefined {
  let current: unknown = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" && current.trim() ? current.trim() : undefined;
}

function normalizeLibreLanguage(
  language: string,
  chineseLanguageCode = "zh",
): string {
  if (
    language === "zh" ||
    language === "zh-CN" ||
    language === "zh-TW" ||
    language === "zh-Hans" ||
    language === "zh-Hant"
  ) {
    return chineseLanguageCode;
  }
  return language;
}

function normalizeDeepLLanguage(language: string): string | undefined {
  if (language === "auto") return undefined;
  if (language.toLowerCase() === "zh") return "ZH";
  return language.toUpperCase();
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return 45_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) return 45_000;
  return Math.floor(timeoutMs);
}

function isSameAttempt(
  left: TranslationConfig | undefined,
  right: TranslationConfig,
): boolean {
  return (
    left?.provider === right.provider &&
    left.apiKey === right.apiKey &&
    (left.endpoint ?? TRANSLATION_ADAPTERS[left.provider].defaultEndpoint) ===
      (right.endpoint ?? TRANSLATION_ADAPTERS[right.provider].defaultEndpoint)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
