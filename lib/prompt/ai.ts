import { z } from "zod";
import { serializeParameters, validateParameters } from "./parameters";
import {
  AiProviderConfigSchema,
  PROVIDER_REGISTRY,
  resolveProviderEndpoint,
  type AiProviderConfig,
  type EndpointValidator,
} from "./providers";
import {
  PromptFieldsSchema,
  type PromptDraft,
  type PromptFields,
  type PromptParameters,
  PROMPT_OUTPUT_MAX_LENGTH,
} from "./types";
import { readLimitedResponseText } from "../server/endpoints";

const DEFAULT_TIMEOUT_MS = 45_000;

const AiStructuredOutputSchema = z
  .object({
    promptZh: z.string().trim().min(1).max(PROMPT_OUTPUT_MAX_LENGTH),
    promptEn: z.string().trim().min(1).max(PROMPT_OUTPUT_MAX_LENGTH),
    fields: PromptFieldsSchema,
  })
  .strict();

export interface GenerateAiPromptInput {
  config: AiProviderConfig;
  idea: string;
  fields?: Partial<PromptFields>;
  parameters?: PromptParameters;
  fetchImpl?: typeof fetch;
  validateEndpoint?: EndpointValidator;
  timeoutMs?: number;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_CONFIG"
      | "UNSAFE_ENDPOINT"
      | "HTTP_ERROR"
      | "INVALID_RESPONSE"
      | "TIMEOUT",
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export async function generateAiPrompt(input: GenerateAiPromptInput): Promise<PromptDraft> {
  const configResult = AiProviderConfigSchema.safeParse(input.config);
  if (!configResult.success) {
    throw new AiProviderError("模型配置无效。", "INVALID_CONFIG");
  }

  const idea = input.idea.trim();
  if (!idea) {
    throw new AiProviderError("请输入创意描述。", "INVALID_CONFIG");
  }

  const config = configResult.data;
  const endpoint = resolveProviderEndpoint(config);
  if (input.validateEndpoint && !(await input.validateEndpoint(endpoint))) {
    throw new AiProviderError("模型 API 地址未通过安全检查。", "UNSAFE_ENDPOINT");
  }

  const fields = PromptFieldsSchema.parse(input.fields ?? {});
  const parametersResult = validateParameters(input.parameters ?? {});
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const userPrompt = buildUserPrompt(idea, fields);

  let lastValidationError = "";
  let previousOutput = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repairPrompt =
      attempt === 0
        ? userPrompt
        : [
            "上一次输出未通过 JSON Schema 校验。",
            `校验错误：${lastValidationError}`,
            "只重新输出修复后的 JSON 对象，不要解释或使用 Markdown 代码块。",
            `待修复输出：${previousOutput.slice(0, 12_000)}`,
          ].join("\n");

    let rawOutput = "";
    try {
      rawOutput = await callProvider({
        config,
        endpoint,
        prompt: repairPrompt,
        fetchImpl,
        timeoutMs,
      });
    } catch (error) {
      if (attempt === 0 && isRetryableProviderError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw error;
    }
    previousOutput = rawOutput;

    const structured = parseStructuredOutput(rawOutput);
    if (structured.success) {
      const suffix = serializeParameters(parametersResult.parameters);
      return {
        promptZh: appendSuffix(structured.data.promptZh, suffix),
        promptEn: appendSuffix(structured.data.promptEn, suffix),
        fields: structured.data.fields,
        translatedFields: {},
        parameters: parametersResult.parameters,
        warnings: parametersResult.warnings,
        source: "ai",
      };
    }

    lastValidationError = structured.error;
  }

  throw new AiProviderError(
    "模型两次返回的内容都不符合提示词结构，请重试或更换模型。",
    "INVALID_RESPONSE",
  );
}

interface CallProviderInput {
  config: AiProviderConfig;
  endpoint: string;
  prompt: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}

async function callProvider(input: CallProviderInput): Promise<string> {
  const definition = PROVIDER_REGISTRY[input.config.provider];
  let response: Response;

  try {
    response = await input.fetchImpl(input.endpoint, {
      method: "POST",
      headers: buildHeaders(input.config, definition.protocol),
      body: JSON.stringify(buildRequestBody(input.config, definition.protocol, input.prompt)),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AiProviderError("模型请求超时，请稍后重试。", "TIMEOUT");
    }
    throw new AiProviderError("无法连接模型服务，请检查地址和网络。", "HTTP_ERROR");
  }

  if (!response.ok) {
    throw new AiProviderError(
      `模型服务请求失败（HTTP ${response.status}）。`,
      "HTTP_ERROR",
      response.status,
    );
  }

  let payload: unknown;
  try {
    const responseText = await readLimitedResponseText(response);
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new AiProviderError("模型服务返回了无法解析的响应。", "INVALID_RESPONSE");
  }

  const content = extractContent(payload, definition.protocol);
  if (!content) {
    throw new AiProviderError("模型响应中没有可用文本。", "INVALID_RESPONSE");
  }
  return content;
}

function buildHeaders(
  config: AiProviderConfig,
  protocol: (typeof PROVIDER_REGISTRY)[keyof typeof PROVIDER_REGISTRY]["protocol"],
): HeadersInit {
  if (protocol === "anthropic") {
    return {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  if (protocol === "gemini") {
    return {
      "content-type": "application/json",
      "x-goog-api-key": config.apiKey,
    };
  }
  return {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`,
  };
}

function buildRequestBody(
  config: AiProviderConfig,
  protocol: (typeof PROVIDER_REGISTRY)[keyof typeof PROVIDER_REGISTRY]["protocol"],
  prompt: string,
): unknown {
  if (protocol === "anthropic") {
    return {
      model: config.model,
      max_tokens: 2_000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    };
  }
  if (protocol === "gemini") {
    return {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    };
  }
  return {
    model: config.model,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  };
}

function extractContent(payload: unknown, protocol: string): string | undefined {
  if (!isRecord(payload)) return undefined;

  if (protocol === "anthropic") {
    const content = payload.content;
    if (!Array.isArray(content)) return undefined;
    return content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  if (protocol === "gemini") {
    const candidates = payload.candidates;
    if (!Array.isArray(candidates)) return undefined;
    const first = candidates[0];
    if (!isRecord(first) || !isRecord(first.content) || !Array.isArray(first.content.parts)) {
      return undefined;
    }
    return first.content.parts
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  const choices = payload.choices;
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return undefined;
  return typeof first.message.content === "string" ? first.message.content.trim() : undefined;
}

function parseStructuredOutput(
  rawOutput: string,
): { success: true; data: z.infer<typeof AiStructuredOutputSchema> } | {
  success: false;
  error: string;
} {
  let json: unknown;
  try {
    json = JSON.parse(rawOutput);
  } catch {
    return { success: false, error: "输出不是合法 JSON。" };
  }

  const parsed = AiStructuredOutputSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; "),
    };
  }
  return { success: true, data: parsed.data };
}

function buildUserPrompt(idea: string, fields: PromptFields): string {
  return [
    `创意描述：${idea}`,
    "现有结构字段（空字段可补全）：",
    JSON.stringify(fields),
    "请生成简洁明确、可直接用于 Midjourney 的中英文提示词，并返回完整结构字段。",
  ].join("\n");
}

function appendSuffix(prompt: string, suffix: string): string {
  return suffix ? `${prompt.trim()} ${suffix}` : prompt.trim();
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new AiProviderError("请求超时配置无效。", "INVALID_CONFIG");
  }
  return Math.floor(timeoutMs);
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function isRetryableProviderError(error: unknown): boolean {
  return (
    error instanceof AiProviderError &&
    (error.code === "TIMEOUT" ||
      (error.code === "HTTP_ERROR" && !!error.status && error.status >= 500))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const SYSTEM_PROMPT = [
  "你是 Midjourney 提示词编辑器。",
  "只能输出一个 JSON 对象，禁止 Markdown、注释和额外属性。",
  '对象必须含 promptZh、promptEn、fields；fields 必须含 subject、action、environment、medium、style、composition、camera、lighting、color、material、mood、negative，且所有值均为字符串。',
  "promptZh 与 promptEn 中不要包含 --v、--ar 等 Midjourney 参数，系统会统一追加。",
].join("\n");
