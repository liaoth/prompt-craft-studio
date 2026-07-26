import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = 128 * 1024,
): Promise<T> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) {
    throw new ApiError(413, "请求内容过大。", "PAYLOAD_TOO_LARGE");
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new ApiError(400, "请求必须包含 JSON 内容。", "INVALID_JSON");
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "请求内容过大。", "PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new ApiError(400, "请求必须是有效的 JSON。", "INVALID_JSON");
  }
  return schema.parse(value);
}

export function pagination(
  request: Request,
  defaults = { page: 1, limit: 20 },
) {
  const url = new URL(request.url);
  const page = positiveInteger(url.searchParams.get("page"), defaults.page, 1, 10_000);
  const limit = positiveInteger(
    url.searchParams.get("limit"),
    defaults.limit,
    1,
    100,
  );
  return { page, limit, offset: (page - 1) * limit };
}

function positiveInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, "分页参数无效。", "INVALID_PAGINATION");
  }
  return parsed;
}

export function ok(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

export function apiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return ok(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return ok(
      {
        error: "请求参数无效。",
        code: "VALIDATION_ERROR",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  if (
    error instanceof Error &&
    error.name === "AiProviderError" &&
    "code" in error
  ) {
    const code = String((error as Error & { code: unknown }).code);
    const status =
      code === "INVALID_CONFIG" || code === "UNSAFE_ENDPOINT" ? 400 : 502;
    return ok(
      { error: error.message, code },
      { status },
    );
  }

  // Do not serialize provider responses, credentials, SQL text, or stack traces.
  return ok(
    { error: "服务器暂时无法处理此请求。", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function route<TContext = unknown>(
  handler: (request: Request, context: TContext) => Promise<Response>,
) {
  return async (request: Request, context: TContext) => {
    try {
      assertSameOriginMutation(request);
      return await handler(request, context);
    } catch (error) {
      return apiError(error);
    }
  };
}

export function assertSameOriginMutation(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new ApiError(403, "拒绝跨站请求。", "CROSS_SITE_REQUEST");
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "拒绝跨站请求。", "CROSS_SITE_REQUEST");
  }
}
