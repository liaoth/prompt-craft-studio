import { createHash } from "node:crypto";

import type { MidjourneyProviderConfigRow } from "@/lib/server/configs";
import {
  MAX_UPSTREAM_RESPONSE_BYTES,
  validateMidjourneyEndpointUrl,
  readLimitedResponseText,
  safeProviderFetch,
} from "@/lib/server/endpoints";
import { ApiError } from "@/lib/server/http";

export type MidjourneySubmitStatus = "pending" | "sent" | "failed";

export type MidjourneySubmissionInput = {
  promptZh: string;
  promptEn: string;
  source: "rule" | "ai";
  snapshot?: Record<string, unknown>;
};

export function createMidjourneyPrompt(
  promptEn: string,
  promptZh: string,
): string {
  return promptEn.trim() || promptZh.trim();
}

export function toMidjourneySubmissionHash(
  input: MidjourneySubmissionInput,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        promptZh: input.promptZh.trim(),
        promptEn: input.promptEn.trim(),
        source: input.source,
      }),
    )
    .digest("hex");
}

function sanitizeResponseBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 1_024) return trimmed;
  return `${trimmed.slice(0, 1_020)}...`;
}

export async function submitToDiscordWebhook(args: {
  endpoint: string;
  apiKey?: string;
  prompt: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{
  status: MidjourneySubmitStatus;
  details: string;
  response: unknown;
}> {
  const fetchImpl = args.fetchImpl ?? safeProviderFetch;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), args.timeoutMs ?? 20_000);

  try {
    const response = await fetchImpl(args.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.apiKey
          ? { Authorization: `Bearer ${args.apiKey}` }
          : {}),
      },
      body: JSON.stringify({ content: args.prompt }),
      signal: abort.signal,
    });

    const responseText = await readLimitedResponseText(
      response,
      MAX_UPSTREAM_RESPONSE_BYTES,
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${sanitizeResponseBody(responseText) || "No response body"}`,
      );
    }

    return {
      status: "sent",
      details: `Discord webhook responded with ${response.status}`,
      response: responseSummary(response),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function submitToCustomHttp(args: {
  endpoint: string;
  apiKey?: string;
  prompt: string;
  snapshot?: Record<string, unknown>;
  source: "rule" | "ai";
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{
  status: MidjourneySubmitStatus;
  details: string;
  response: unknown;
}> {
  const payload = {
    prompt: args.prompt,
    snapshot: args.snapshot ?? {},
    source: args.source,
  };

  const fetchImpl = args.fetchImpl ?? safeProviderFetch;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), args.timeoutMs ?? 20_000);

  try {
    const response = await fetchImpl(args.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.apiKey ? { Authorization: `Bearer ${args.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });

    const responseText = await readLimitedResponseText(
      response,
      MAX_UPSTREAM_RESPONSE_BYTES,
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${sanitizeResponseBody(responseText) || "No response body"}`,
      );
    }

    return {
      status: "sent",
      details: `Custom HTTP endpoint responded with ${response.status}`,
      response: responseSummary(response),
    };
  } finally {
    clearTimeout(timer);
  }
}

function responseSummary(response: Response): Record<string, string | number> {
  const summary: Record<string, string | number> = {
    httpStatus: response.status,
  };
  const contentType = response.headers.get("content-type");
  const requestId =
    response.headers.get("x-request-id") ||
    response.headers.get("x-correlation-id");
  if (contentType) summary.contentType = contentType.slice(0, 120);
  if (requestId) summary.requestId = requestId.slice(0, 200);
  return summary;
}

export async function sendToMidjourney(args: {
  provider: MidjourneyProviderConfigRow["provider"];
  endpoint: MidjourneyProviderConfigRow["endpoint"];
  credential?: string;
  prompt: string;
  snapshot?: Record<string, unknown>;
  source: "rule" | "ai";
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ status: MidjourneySubmitStatus; details: string; response: unknown }> {
  if (!(await validateMidjourneyEndpointUrl(args.endpoint, { resolveDns: true }))) {
    throw new ApiError(400, "Midjourney submit endpoint rejected by security check", "UNSAFE_ENDPOINT");
  }

  switch (args.provider) {
    case "discord_webhook":
      return submitToDiscordWebhook({
        endpoint: args.endpoint,
        apiKey: args.credential,
        prompt: args.prompt,
        fetchImpl: args.fetchImpl,
        timeoutMs: args.timeoutMs,
      });
    case "custom_http":
      return submitToCustomHttp({
        endpoint: args.endpoint,
        apiKey: args.credential,
        prompt: args.prompt,
        snapshot: args.snapshot,
        source: args.source,
        fetchImpl: args.fetchImpl,
        timeoutMs: args.timeoutMs,
      });
    default:
      throw new ApiError(400, "不支持的 Midjourney 提交类型", "INVALID_CONFIG");
  }
}
