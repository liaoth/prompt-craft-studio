import { assertAuthConfigured, auth } from "@/lib/auth";

async function withConfigurationCheck(request: Request) {
  try {
    assertAuthConfigured();
    return await auth.handler(request);
  } catch {
    return Response.json({ error: "认证服务暂不可用。" }, { status: 503 });
  }
}

export const GET = withConfigurationCheck;
export const POST = withConfigurationCheck;
export const PATCH = withConfigurationCheck;
export const PUT = withConfigurationCheck;
export const DELETE = withConfigurationCheck;
