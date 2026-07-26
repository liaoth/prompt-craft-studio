import { z } from "zod";

export const AI_PROVIDER_IDS = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "qwen",
  "doubao",
  "zhipu",
  "kimi",
  "minimax",
  "ollama",
  "custom",
] as const;

export const AiProviderIdSchema = z.enum(AI_PROVIDER_IDS);
export type AiProviderId = z.infer<typeof AiProviderIdSchema>;

export const AiProviderConfigSchema = z
  .object({
    provider: AiProviderIdSchema,
    apiKey: z.string().max(8_192).default(""),
    model: z.string().trim().min(1).max(200),
    endpoint: z.url().optional(),
  })
  .strict()
  .superRefine((config, context) => {
    if (config.provider === "custom" && !config.endpoint) {
      context.addIssue({
        code: "custom",
        path: ["endpoint"],
        message: "自定义 OpenAI 兼容供应商必须提供 endpoint。",
      });
    }
    if (config.provider !== "ollama" && !config.apiKey) {
      context.addIssue({
        code: "custom",
        path: ["apiKey"],
        message: "云端模型必须提供 API Key。",
      });
    }
  });

export type AiProviderConfig = z.infer<typeof AiProviderConfigSchema>;

export type ProviderProtocol = "openai-compatible" | "anthropic" | "gemini";

export interface ProviderDefinition {
  id: AiProviderId;
  label: string;
  protocol: ProviderProtocol;
  defaultModel: string;
  defaultEndpoint: string | ((model: string) => string);
}

export const PROVIDER_REGISTRY: Readonly<Record<AiProviderId, ProviderDefinition>> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    protocol: "openai-compatible",
    defaultModel: "gpt-4.1-mini",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    protocol: "anthropic",
    defaultModel: "claude-sonnet-4-5",
    defaultEndpoint: "https://api.anthropic.com/v1/messages",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    protocol: "gemini",
    defaultModel: "gemini-2.5-flash",
    defaultEndpoint: (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai-compatible",
    defaultModel: "deepseek-v4-flash",
    defaultEndpoint: "https://api.deepseek.com/v1/chat/completions",
  },
  qwen: {
    id: "qwen",
    label: "通义千问",
    protocol: "openai-compatible",
    defaultModel: "qwen-plus",
    defaultEndpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  },
  doubao: {
    id: "doubao",
    label: "豆包",
    protocol: "openai-compatible",
    defaultModel: "doubao-seed-1-6-flash-250828",
    defaultEndpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  },
  zhipu: {
    id: "zhipu",
    label: "智谱",
    protocol: "openai-compatible",
    defaultModel: "glm-4-flash",
    defaultEndpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  },
  kimi: {
    id: "kimi",
    label: "Kimi",
    protocol: "openai-compatible",
    defaultModel: "moonshot-v1-8k",
    defaultEndpoint: "https://api.moonshot.cn/v1/chat/completions",
  },
  minimax: {
    id: "minimax",
    label: "MiniMax",
    protocol: "openai-compatible",
    defaultModel: "MiniMax-M2.1",
    defaultEndpoint: "https://api.minimax.io/v1/chat/completions",
  },
  ollama: {
    id: "ollama",
    label: "本地 Ollama",
    protocol: "openai-compatible",
    defaultModel: "qwen2.5:3b",
    defaultEndpoint: "http://127.0.0.1:11434/v1/chat/completions",
  },
  custom: {
    id: "custom",
    label: "自定义 OpenAI 兼容",
    protocol: "openai-compatible",
    defaultModel: "",
    defaultEndpoint: "",
  },
};

export type EndpointValidator = (endpoint: string) => boolean | Promise<boolean>;

export function resolveProviderEndpoint(config: AiProviderConfig): string {
  const definition = PROVIDER_REGISTRY[config.provider];
  if (config.endpoint) return config.endpoint;
  if (typeof definition.defaultEndpoint === "function") {
    return definition.defaultEndpoint(config.model);
  }
  if (!definition.defaultEndpoint) {
    throw new Error("该供应商需要配置 API endpoint。");
  }
  return definition.defaultEndpoint;
}
