import { describe, expect, it, vi } from "vitest";
import {
  PARAMETER_BY_ID,
  emptyPromptFields,
  filterUnsupportedParameters,
  generateAiPrompt,
  generateRulePrompt,
  parameterAvailability,
  serializeParameters,
  supportedParameterOptions,
  testAiProviderConnection,
  translateText,
  validateParameters,
} from "../lib/prompt";

describe("rule prompt generation", () => {
  it("uses canonical field order and appends parameters at the end", () => {
    const draft = generateRulePrompt({
      fields: {
        subject: "一只白猫",
        action: "奔跑",
        environment: "雨夜街道",
        lighting: "霓虹逆光",
        negative: "文字",
      },
      translatedFields: {
        subject: "a white cat",
        action: "running",
        environment: "a rainy street at night",
        lighting: "neon rim light",
        negative: "text",
      },
      parameters: {
        model: "7",
        aspectRatio: "16:9",
        stylize: 250,
        no: ["watermark"],
      },
    });

    expect(draft.promptEn).toBe(
      "a white cat, running, a rainy street at night, neon rim light --v 7 --ar 16:9 --s 250 --no text, watermark",
    );
    expect(draft.promptEn.indexOf("running")).toBeLessThan(
      draft.promptEn.indexOf("a rainy street"),
    );
    expect(draft.promptEn.indexOf("a rainy street")).toBeLessThan(
      draft.promptEn.indexOf("neon rim light"),
    );
    expect(draft.bodyEn).not.toContain("exclude:");
    expect(draft.promptEn.endsWith("--no text, watermark")).toBe(true);
    expect(draft.promptEn.match(/--no/g)).toHaveLength(1);
  });

  it("resolves bilingual presets without translating free text implicitly", () => {
    const draft = generateRulePrompt({
      fields: { subject: "玻璃鲸鱼" },
      presetIds: ["style-cinematic", "lighting-soft"],
    });

    expect(draft.promptZh).toContain("电影美学");
    expect(draft.promptEn).toContain("cinematic aesthetic");
    expect(draft.promptEn).toContain("玻璃鲸鱼");
  });

  it("uses a translated custom phrase only in the English output", () => {
    const draft = generateRulePrompt({
      fields: { subject: "玻璃鲸鱼" },
      translatedFields: { subject: "a glass whale" },
      custom: "电影感体积光",
      translatedCustom: "cinematic volumetric lighting",
    });

    expect(draft.promptZh).toContain("电影感体积光");
    expect(draft.promptEn).toContain("cinematic volumetric lighting");
    expect(draft.promptEn).not.toContain("电影感体积光");
  });
});

describe("Midjourney parameter validation", () => {
  it("reports ranges and model-aware conflicts", () => {
    const result = validateParameters({
      model: "niji-6",
      aspectRatio: "16:9",
      stylize: 1001,
      weird: 120,
      seed: 42,
      tile: true,
    });

    expect(result.valid).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "parameter_out_of_range",
          field: "stylize",
          severity: "error",
        }),
        expect.objectContaining({
          code: "weird_seed_interaction",
          field: "seed",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "tile_aspect_ratio",
          field: "aspectRatio",
        }),
      ]),
    );
  });

  it("validates model-specific quality values", () => {
    const result = validateParameters({ model: "8.1", quality: 4 });
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toMatchObject({
      code: "unsupported_quality",
      field: "quality",
    });
    const quality = PARAMETER_BY_ID.get("quality")!;
    expect(
      parameterAvailability(quality, {
        model: "8.1",
        targetSurface: "web",
        taskType: "image",
      }),
    ).toMatchObject({
      supported: false,
      reason: "模型 8.1 不支持 Quality",
    });
    expect(
      filterUnsupportedParameters(
        { model: "8.1", quality: 4, chaos: 0 },
        { targetSurface: "web", taskType: "image" },
      ),
    ).toEqual({ model: "8.1", chaos: 0 });
    const serialized = serializeParameters(
      { model: "8.1", quality: 4, chaos: 5 },
      { targetSurface: "web", taskType: "image" },
    );
    expect(serialized).toContain("--chaos 5");
    expect(serialized).not.toContain("--quality");
  });

  it("filters unsupported parameter values from contextual options", () => {
    const speedMode = PARAMETER_BY_ID.get("speedMode")!;
    const quality = PARAMETER_BY_ID.get("quality")!;
    expect(supportedParameterOptions(speedMode, "8.2")).toEqual([
      "fast",
      "relax",
    ]);
    expect(supportedParameterOptions(speedMode, "7")).toEqual([
      "fast",
      "relax",
      "turbo",
    ]);
    expect(supportedParameterOptions(quality, "7")).toEqual([1, 2, 4]);
    expect(supportedParameterOptions(quality, "8.1")).toEqual([]);
  });
});

describe("AI structured generation", () => {
  it("repairs one invalid JSON response and validates the retry", async () => {
    const fields = {
      ...emptyPromptFields(),
      subject: "a red fox",
      environment: "snowy forest",
    };
    const repaired = JSON.stringify({
      variants: [
        {
          id: "concise",
          promptZh: "雪林红狐",
          promptEn: "red fox, snowy forest",
          fieldsZh: { ...fields, subject: "红狐", environment: "雪林" },
          fieldsEn: fields,
        },
        {
          id: "detailed",
          promptZh: "雪林中的红狐",
          promptEn: "a red fox in a snowy forest",
          fieldsZh: { ...fields, subject: "红狐", environment: "雪林" },
          fieldsEn: fields,
        },
        {
          id: "experimental",
          promptZh: "梦境雪林中的红狐",
          promptEn: "a dreamlike red fox in a snowy forest",
          fieldsZh: { ...fields, subject: "红狐", environment: "梦境雪林" },
          fieldsEn: { ...fields, environment: "dreamlike snowy forest" },
        },
      ],
    });
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: repaired } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const fetchImpl = fetchSpy as unknown as typeof fetch;

    const result = await generateAiPrompt({
      config: {
        provider: "openai",
        apiKey: "secret-test-key",
        model: "gpt-test",
        endpoint: "https://models.example.test/chat/completions",
      },
      idea: "雪林中的红狐",
      parameters: { model: "7", aspectRatio: "3:2" },
      fetchImpl,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("ai");
    expect(result.promptEn).toBe("a red fox, snowy forest --v 7 --ar 3:2");
    expect(result.variants.map((variant) => variant.id)).toEqual([
      "concise",
      "detailed",
      "experimental",
    ]);

    const secondRequest = fetchSpy.mock.calls[1]?.[1] as RequestInit;
    expect(String(secondRequest.body)).toContain("上一次输出未通过");
    expect(String(secondRequest.body)).not.toContain("secret-test-key");
  });

  it("accepts common local-model wrappers and fills missing field objects", async () => {
    const content = JSON.stringify({
      variants: [
        {
          id: "concise",
          promptZh: "紫色玻璃魔棒",
          promptEn: "purple glass magic wand",
        },
        "detailed",
        {
          id: "detailed",
          promptZh: "精致的紫色玻璃魔棒",
          promptEn: "a delicate purple glass magic wand",
          fieldsZh: { subject: "紫色玻璃魔棒" },
          fieldsEn: { subject: "purple glass magic wand" },
        },
        "experimental",
        {
          id: "experimental",
          promptZh: "漂浮的紫色玻璃魔棒",
          promptEn: "a floating purple glass magic wand",
        },
      ],
    });
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await generateAiPrompt({
      config: {
        provider: "custom",
        apiKey: "ollama",
        model: "qwen2.5:3b",
        endpoint: "http://127.0.0.1:11434/v1/chat/completions",
      },
      idea: "紫色玻璃魔棒",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.variants).toHaveLength(3);
    expect(result.variants[0]?.bodyEn).toBe("purple glass magic wand");
  });
});

describe("AI provider connection test", () => {
  it("accepts a bounded OpenAI-compatible JSON health response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"status":"ok"}' } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      testAiProviderConnection({
        config: {
          provider: "custom",
          model: "qwen3:8b",
          apiKey: "ollama",
          endpoint: "https://models.example.test/v1/chat/completions",
        },
        fetchImpl: fetchSpy as unknown as typeof fetch,
        validateEndpoint: () => true,
      }),
    ).resolves.toBeUndefined();

    const request = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe("POST");
    expect(String(request.body)).toContain('"response_format":{"type":"json_object"}');
    expect(String(request.body)).not.toContain("variants");
  });
});

describe("translation adapters", () => {
  it("falls back from a user provider to shared LibreTranslate", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ translatedText: "a crystal castle" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const fetchImpl = fetchSpy as unknown as typeof fetch;

    const result = await translateText({
      text: "水晶城堡",
      sourceLanguage: "zh",
      targetLanguage: "en",
      config: {
        provider: "deepl",
        apiKey: "deepl-key",
        endpoint: "https://deepl.example.test/translate",
      },
      sharedLibreTranslateConfig: {
        provider: "libretranslate",
        endpoint: "https://libre.example.test/translate",
        apiKey: "shared-libre-key",
        chineseLanguageCode: "zh-Hans",
      },
      fetchImpl,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      text: "a crystal castle",
      translated: true,
      provider: "libretranslate",
    });
    const sharedRequest = fetchSpy.mock.calls[1]?.[1] as RequestInit;
    expect(String(sharedRequest.body)).toContain("shared-libre-key");
    expect(String(sharedRequest.body)).toContain('"source":"zh-Hans"');
  });

  it("keeps the original text when all translation attempts fail", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch;
    const result = await translateText({
      text: "晨雾森林",
      targetLanguage: "en",
      sharedLibreTranslateEndpoint: "https://libre.example.test/translate",
      fetchImpl,
    });

    expect(result.text).toBe("晨雾森林");
    expect(result.translated).toBe(false);
    expect(result.warning).toContain("已保留原文");
  });
});
