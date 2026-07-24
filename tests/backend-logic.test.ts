import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "../lib/crypto";
import {
  isPublicIp,
  validateEndpointUrl,
  validateMidjourneyEndpointUrl,
} from "../lib/server/endpoints";
import {
  submitToCustomHttp,
  submitToDiscordWebhook,
  toMidjourneySubmissionHash,
} from "../lib/server/midjourney";
import {
  HISTORY_LIMIT,
  historyIdsToPrune,
  promptContentHash,
} from "../lib/server/history";
import {
  decryptedEndpoint,
  encryptedEndpoint,
  providerConfigUpdateSchema,
  translationConfigUpdateSchema,
} from "../lib/server/configs";
import { phraseUpdateSchema } from "../lib/server/validation";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("credential encryption", () => {
  it("round trips through AES-256-GCM without exposing plaintext", () => {
    const encrypted = encryptSecret("sk-test-super-secret", TEST_KEY);
    expect(encrypted).not.toContain("sk-test-super-secret");
    expect(decryptSecret(encrypted, TEST_KEY)).toBe("sk-test-super-secret");
  });

  it("rejects a modified authentication tag", () => {
    const encrypted = encryptSecret("secret", TEST_KEY);
    const parts = encrypted.split(".");
    const replacement = parts[2].startsWith("A") ? "B" : "A";
    parts[2] = `${replacement}${parts[2].slice(1)}`;
    expect(() => decryptSecret(parts.join("."), TEST_KEY)).toThrow(
      "凭据解密失败",
    );
  });

  it("only reveals the last four characters", () => {
    expect(maskSecret("sk-1234567890")).toBe("••••••••7890");
  });

  it("encrypts endpoints at rest and supports legacy plaintext rows", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY);
    const endpoint = "https://discord.com/api/webhooks/123/secret-token";
    const encrypted = encryptedEndpoint(endpoint);
    expect(encrypted).not.toContain("discord.com");
    expect(decryptedEndpoint(encrypted)).toBe(endpoint);
    expect(decryptedEndpoint(endpoint)).toBe(endpoint);
  });
});

describe("history retention", () => {
  it("keeps the newest 100 and returns overflow ids", () => {
    const entries = Array.from({ length: 105 }, (_, index) => ({
      id: `id-${String(index).padStart(3, "0")}`,
      updatedAt: new Date(2026, 0, 1, 0, index),
    }));
    const pruned = historyIdsToPrune(entries);
    expect(pruned).toHaveLength(5);
    expect(pruned).toEqual([
      "id-004",
      "id-003",
      "id-002",
      "id-001",
      "id-000",
    ]);
    expect(HISTORY_LIMIT).toBe(100);
  });

  it("deduplicates semantically identical parameter objects", () => {
    const first = promptContentHash({
      promptZh: "测试",
      promptEn: "test",
      source: "rule",
      parameters: { stylize: 100, raw: true },
    });
    const second = promptContentHash({
      promptZh: "不同中文不影响最终提示词身份",
      promptEn: "test",
      source: "ai",
      parameters: { raw: true, stylize: 100 },
    });
    expect(first).toBe(second);
  });
});

describe("provider endpoint validation", () => {
  it("allows known TLS provider endpoints", async () => {
    await expect(
      validateEndpointUrl("https://api.openai.com/v1/chat/completions", {
        development: false,
        resolveDns: false,
      }),
    ).resolves.toBe(true);
  });

  it("rejects credentials, insecure custom URLs, and private IPs", async () => {
    await expect(
      validateEndpointUrl("https://token@example.com/api", {
        development: false,
        resolveDns: false,
      }),
    ).resolves.toBe(false);
    await expect(
      validateEndpointUrl("http://example.com/api", {
        development: false,
        resolveDns: false,
      }),
    ).resolves.toBe(false);
    await expect(
      validateEndpointUrl("https://169.254.169.254/latest/meta-data", {
        development: false,
        resolveDns: false,
      }),
    ).resolves.toBe(false);
  });

  it("always rejects localhost/private addresses", async () => {
    await expect(
      validateEndpointUrl("http://localhost:5000/v1", {
        development: true,
        resolveDns: false,
      }),
    ).resolves.toBe(false);
    await expect(
      validateEndpointUrl("http://localhost:5000/v1", {
        development: false,
        resolveDns: false,
      }),
    ).resolves.toBe(false);
    expect(isPublicIp("10.0.0.4")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("fd00::1")).toBe(false);
  });

  it("requires an operator allowlist for production custom hosts", async () => {
    await expect(
      validateEndpointUrl("https://models.example.test/v1", {
        development: false,
        resolveDns: false,
      }),
    ).resolves.toBe(false);

    vi.stubEnv("CUSTOM_ENDPOINT_HOST_ALLOWLIST", "models.example.test");
    await expect(
      validateEndpointUrl("https://models.example.test/v1", {
        development: false,
        resolveDns: false,
      }),
    ).resolves.toBe(true);
  });
});

describe("Midjourney direct submission", () => {
  it("allows genuine Discord webhook URLs and rejects lookalike hosts", async () => {
    await expect(
      validateMidjourneyEndpointUrl(
        "https://discord.com/api/webhooks/123/token",
        { development: false, resolveDns: false },
      ),
    ).resolves.toBe(true);
    await expect(
      validateMidjourneyEndpointUrl(
        "https://evildiscord.com/api/webhooks/123/token",
        { development: false, resolveDns: false },
      ),
    ).resolves.toBe(false);
    await expect(
      validateMidjourneyEndpointUrl(
        "https://discord.com/not-a-webhook",
        { development: false, resolveDns: false },
      ),
    ).resolves.toBe(false);
  });

  it("sends Discord-compatible content and accepts a 204 response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await submitToDiscordWebhook({
      endpoint: "https://discord.com/api/webhooks/123/token",
      prompt: "a glass whale --ar 16:9",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    expect(result.status).toBe("sent");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      content: "a glass whale --ar 16:9",
    });
  });

  it("records adapter failure details without including credentials", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("upstream rejected", { status: 429, statusText: "Too Many Requests" }),
    );
    await expect(
      submitToCustomHttp({
        endpoint: "https://submit.example.test/midjourney",
        apiKey: "top-secret-key",
        prompt: "test prompt",
        source: "rule",
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.toThrow("HTTP 429");
    await expect(
      submitToCustomHttp({
        endpoint: "https://submit.example.test/midjourney",
        apiKey: "top-secret-key",
        prompt: "test prompt",
        source: "rule",
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.not.toThrow("top-secret-key");
  });

  it("creates stable content hashes for identical submissions", () => {
    const first = toMidjourneySubmissionHash({
      promptZh: "玻璃鲸鱼",
      promptEn: "a glass whale",
      source: "rule",
    });
    const second = toMidjourneySubmissionHash({
      promptZh: "  玻璃鲸鱼  ",
      promptEn: "a glass whale",
      source: "rule",
    });
    expect(first).toBe(second);
  });
});

describe("partial update validation", () => {
  it("does not inject create-time defaults into PATCH payloads", () => {
    expect(providerConfigUpdateSchema.parse({ isActive: true })).toEqual({
      isActive: true,
    });
    expect(translationConfigUpdateSchema.parse({ isActive: true })).toEqual({
      isActive: true,
    });
    expect(phraseUpdateSchema.parse({ name: "新名称" })).toEqual({
      name: "新名称",
    });
  });
});
