import { LOCAL_USER_ID } from "@/db/schema";

const LOCAL_WORKSPACE = {
  user: {
    id: LOCAL_USER_ID,
    name: "Local Workspace",
    email: "local@prompt-craft.invalid",
    emailVerified: true,
  },
} as const;

/**
 * Keep the former session-shaped boundary so business routes stay scoped to
 * one server-owned identity without accepting a client-supplied user id.
 */
export async function requireSession(request?: Request) {
  void request;
  return LOCAL_WORKSPACE;
}
