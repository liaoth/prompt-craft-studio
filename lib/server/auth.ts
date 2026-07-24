import type { NextRequest } from "next/server";

import { assertAuthConfigured, auth } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor(
    message = "请先登录。",
    public readonly status = 401,
    public readonly code = "UNAUTHORIZED",
  ) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireSession(request: Request | NextRequest) {
  assertAuthConfigured();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) throw new UnauthorizedError();
  if (!session.user.emailVerified) {
    throw new UnauthorizedError(
      "请先完成邮箱验证。",
      403,
      "EMAIL_NOT_VERIFIED",
    );
  }
  return session;
}
