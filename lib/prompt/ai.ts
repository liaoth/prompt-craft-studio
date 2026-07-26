import { z } from "zod";
import {
  blocksToFields,
  composePromptBodies,
  fieldsToBlocks,
  parametersWithNegativeBlocks,
  reconcileNegativeBlocks,
} from "./blocks";
import { composePromptWithReferences, validatePromptConfiguration } from "./references";
import {
  AiProviderConfigSchema,
  PROVIDER_REGISTRY,
  resolveProviderEndpoint,
  type AiProviderConfig,
  type EndpointValidator,
} from "./providers";
import {
  PromptFieldsSchema,
  PromptVariantKindSchema,
  type PromptDraft,
  type PromptFields,
  type PromptParameters,
  type PromptReferences,
  type PromptVariant,
  type TargetSurface,
  type TaskType,
  PROMPT_OUTPUT_MAX_LENGTH,
} from "./types";
import { readLimitedResponseText } from "../server/endpoints";

const DEFAULT_TIMEOUT_MS = 45_000;
const VARIANT_LABELS = {
  concise: "简洁",
  detailed: "详细",
  experimental: "实验性",
} as const;

const AiVariantSchema = z
  .object({
    id: PromptVariantKindSchema,
    promptZh: z.string().trim().min(1).max(PROMPT_OUTPUT_MAX_LENGTH),
    promptEn: z.string().trim().min(1).max(PROMPT_OUTPUT_MAX_LENGTH),
    fieldsZh: PromptFieldsSchema.partial().default({}),
    fieldsEn: PromptFieldsSchema.partial().default({}),
  })
  .strict();

const AiStructuredOutputSchema = z
  .object({
    variants: z.array(AiVariantSchema).length(3),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set(value.variants.map((variant) => variant.id));
    for (const id of ["concise", "detailed", "experimental"] as const) {
      if (!ids.has(id)) {
        context.addIssue({
          code: "custom",
          path: ["variants"],
          message: `缺少 ${id} 版本。`,
        });
      }
    }
  });

export interface GenerateAiPromptInput {
  config: AiProviderConfig;
  idea: string;
  fields?: Partial<PromptFields>;
  parameters?: PromptParameters;
  targetSurface?: TargetSurface;
  taskType?: TaskType;
  references?: PromptReferences;
  fetchImpl?: typeof fetch;
  validateEndpoint?: EndpointValidator;
  timeoutMs?: number;
}

export interface TestAiProviderInput {
  config: AiProviderConfig;
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

export async function testAiProviderConnection(
  input: TestAiProviderInput,
): Promise<void> {
  const configResult = AiProviderConfigSchema.safeParse(input.config);
  if (!configResult.success) {
    throw new AiProviderError("模型配置无效。", "INVALID_CONFIG");
  }
  const config = configResult.data;
  const endpoint = resolveProviderEndpoint(config);
  if (input.validateEndpoint && !(await input.validateEndpoint(endpoint))) {
    throw new AiProviderError(
      "模型 API 地址未通过安全检查。",
      "UNSAFE_ENDPOINT",
    );
  }
  const rawOutput = await callProvider({
    config,
    endpoint,
    prompt: '只返回 {"status":"ok"}。',
    systemPrompt: "只返回一个 JSON 对象，不要使用 Markdown 或添加解释。",
    fetchImpl: input.fetchImpl ?? fetch,
    timeoutMs: normalizeTimeout(input.timeoutMs),
  });
  try {
    const parsed = JSON.parse(rawOutput) as { status?: unknown };
    if (parsed.status !== "ok") throw new Error("invalid status");
  } catch {
    throw new AiProviderError(
      "模型连接成功，但未返回要求的结构化 JSON。",
      "INVALID_RESPONSE",
    );
  }
}

export async function generateAiPrompt(input: GenerateAiPromptInput): Promise<PromptDraft> {
  const configResult = AiProviderConfigSchema.safeParse(input.config);
  if (!configResult.success) {
    throw new AiProviderError("模型配置无效。", "INVALID_CONFIG");
  }
  const idea = input.idea.trim();
  if (!idea) {
    throw new AiProviderError("请输入中文创意描述。", "INVALID_CONFIG");
  }

  const targetSurface = input.targetSurface ?? "web";
  const taskType = input.taskType ?? "image";
  const configuration = validatePromptConfiguration(
    input.parameters ?? {},
    input.references ?? {
      imagePrompts: [],
      styleReferences: [],
      omniReference: null,
      videoStart: null,
      videoEnd: null,
    },
    { targetSurface, taskType },
  );
  if (!configuration.valid) {
    throw new AiProviderError(
      configuration.warnings.find((warning) => warning.severity === "error")?.message ??
        "Midjourney 参数无效。",
      "INVALID_CONFIG",
    );
  }

  const config = configResult.data;
  const endpoint = resolveProviderEndpoint(config);
  if (input.validateEndpoint && !(await input.validateEndpoint(endpoint))) {
    throw new AiProviderError("模型 API 地址未通过安全检查。", "UNSAFE_ENDPOINT");
  }

  const fields = PromptFieldsSchema.parse(input.fields ?? {});
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const userPrompt = buildUserPrompt(idea, fields);
  let previousOutput = "";
  let lastValidationError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt =
      attempt === 0
        ? userPrompt
        : [
            "上一次输出未通过 JSON Schema 校验。",
            `校验错误：${lastValidationError}`,
            "只返回修复后的 JSON 对象，不要解释或使用 Markdown 代码块。",
            `待修复输出：${previousOutput.slice(0, 12_000)}`,
          ].join("\n");
    const rawOutput = await callProvider({
      config,
      endpoint,
      prompt,
      fetchImpl,
      timeoutMs,
    });
    previousOutput = rawOutput;
    const structured = parseStructuredOutput(rawOutput);
    if (!structured.success) {
      lastValidationError = structured.error;
      continue;
    }

    const variants = structured.data.variants.map<PromptVariant>((item) => {
      let candidateBlocks = fieldsToBlocks(item.fieldsZh, item.fieldsEn, "ai");
      if (!candidateBlocks.length) {
        candidateBlocks = fieldsToBlocks(
          { subject: item.promptZh },
          { subject: item.promptEn },
          "ai",
        );
      }
      candidateBlocks = candidateBlocks.map((block) => ({
        ...block,
        id: `${item.id}-${block.id}`,
      }));
      const reconciled = reconcileNegativeBlocks(
        candidateBlocks,
        configuration.parameters,
      );
      const blocks = reconciled.blocks;
      const variantParameters = parametersWithNegativeBlocks(
        reconciled.parameters,
        blocks,
      );
      const composed = composePromptBodies(blocks);
      const bodyZh = composed.bodyZh || composed.bodyEn;
      const bodyEn = composed.bodyEn || composed.bodyZh;
      return {
        id: item.id,
        label: VARIANT_LABELS[item.id],
        blocks,
        bodyZh,
        bodyEn,
        promptZh: composePromptWithReferences(
          bodyZh,
          variantParameters,
          configuration.references,
          { targetSurface, taskType },
        ),
        promptEn: composePromptWithReferences(
          bodyEn,
          variantParameters,
          configuration.references,
          { targetSurface, taskType },
        ),
      };
    });
    const selected = variants.find((variant) => variant.id === "detailed")!;
    return {
      schemaVersion: 4,
      variants,
      selectedVariant: "detailed",
      blocks: selected.blocks,
      bilingualSyncEnabled: /[\u3400-\u9fff]/.test(input.idea),
      targetSurface,
      taskType,
      bodyZh: selected.bodyZh,
      bodyEn: selected.bodyEn,
      promptZh: selected.promptZh,
      promptEn: selected.promptEn,
      fields: blocksToFields(selected.blocks, "zh"),
      translatedFields: blocksToFields(selected.blocks, "en"),
      parameters: parametersWithNegativeBlocks(
        configuration.parameters,
        selected.blocks,
      ),
      references: configuration.references,
      warnings: configuration.warnings,
      source: "ai",
    };
  }

  throw new AiProviderError(
    "模型两次返回的内容都不符合三版本结构，请重试或更换模型。",
    "INVALID_RESPONSE",
  );
}

interface CallProviderInput {
  config: AiProviderConfig;
  endpoint: string;
  prompt: string;
  systemPrompt?: string;
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
      body: JSON.stringify(
        buildRequestBody(
          input.config,
          definition.protocol,
          input.prompt,
          input.systemPrompt,
        ),
      ),
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
    return { "content-type": "application/json", "x-goog-api-key": config.apiKey };
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
  systemPrompt = SYSTEM_PROMPT,
): unknown {
  if (protocol === "anthropic") {
    return {
      model: config.model,
      max_tokens: 5_000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    };
  }
  if (protocol === "gemini") {
    return {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
    };
  }
  return {
    model: config.model,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  };
}

function extractContent(payload: unknown, protocol: string): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (protocol === "anthropic") {
    return Array.isArray(payload.content)
      ? payload.content
          .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
          .join("")
          .trim()
      : undefined;
  }
  if (protocol === "gemini") {
    const first = Array.isArray(payload.candidates) ? payload.candidates[0] : undefined;
    if (!isRecord(first) || !isRecord(first.content) || !Array.isArray(first.content.parts)) {
      return undefined;
    }
    return first.content.parts
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  const first = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  return isRecord(first) && isRecord(first.message) && typeof first.message.content === "string"
    ? first.message.content.trim()
    : undefined;
}

function parseStructuredOutput(
  rawOutput: string,
):
  | { success: true; data: z.infer<typeof AiStructuredOutputSchema> }
  | { success: false; error: string } {
  const candidates = [
    rawOutput.trim(),
    rawOutput
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim(),
  ];
  const firstObject = rawOutput.indexOf("{");
  const lastObject = rawOutput.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    candidates.push(rawOutput.slice(firstObject, lastObject + 1));
  }

  let json: unknown;
  let parsedJson = false;
  for (const candidate of candidates) {
    try {
      json = JSON.parse(candidate);
      parsedJson = true;
      break;
    } catch {
      // Try the next common model-output wrapper.
    }
  }
  if (!parsedJson) {
    return { success: false, error: "输出不是合法 JSON。" };
  }

  json = normalizeStructuredOutput(json);
  const parsed = AiStructuredOutputSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; "),
    };
  }
  return { success: true, data: parsed.data };
}

function normalizeStructuredOutput(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.variants)) return value;

  return {
    ...value,
    // Smaller local models sometimes repeat a variant label as a string
    // before emitting the actual object. Those markers carry no data.
    variants: value.variants
      .filter((variant): variant is Record<string, unknown> => isRecord(variant))
      .map((variant) => ({
        ...variant,
        promptZh: variant.promptZh ?? variant.prompt_zh,
        promptEn: variant.promptEn ?? variant.prompt_en,
        fieldsZh: variant.fieldsZh ?? variant.fields_zh ?? {},
        fieldsEn: variant.fieldsEn ?? variant.fields_en ?? {},
      })),
  };
}

function buildUserPrompt(idea: string, fields: PromptFields): string {
  return [
    `中文创意：${idea}`,
    "已有结构字段（空字段可补全）：",
    JSON.stringify(fields),
    "生成 concise、detailed、experimental 三个专业版本。每个版本都必须保留创意核心，中英文语义一致，英文可直接用于 Midjourney。",
  ].join("\n");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const SYSTEM_PROMPT = [
  "你是资深 Midjourney 提示词编辑器。",
  "只输出一个 JSON 对象，禁止 Markdown、注释和额外属性。",
  "对象格式：{\"variants\":[{\"id\":\"concise|detailed|experimental\",\"promptZh\":\"...\",\"promptEn\":\"...\",\"fieldsZh\":{...12个字段},\"fieldsEn\":{...12个字段}}]}。",
  "variants 必须恰好包含 concise、detailed、experimental 各一次。",
  "fieldsZh 和 fieldsEn 必须分别包含 subject、action、environment、composition、camera、lighting、color、material、medium、style、mood、negative，值均为字符串且语义对应。",
  "promptZh 和 promptEn 不得包含 --v、--ar 等参数，参数由系统统一追加。",
].join("\n");
