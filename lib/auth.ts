import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import nodemailer from "nodemailer";

import * as schema from "@/db/schema";
import { lazyDb } from "@/lib/db";

const BUILD_ONLY_SECRET =
  "build-only-placeholder-change-me-before-running-production-32chars";

export function assertAuthConfigured(): void {
  const secret = process.env.BETTER_AUTH_SECRET?.trim() ?? "";
  const unsafePlaceholder =
    secret === BUILD_ONLY_SECRET ||
    /^(replace|change)[-_ ]?with/i.test(secret);

  if (secret.length < 32 || unsafePlaceholder) {
    throw new Error(
      "BETTER_AUTH_SECRET 必须配置为至少 32 个字符的随机密钥，且不能使用示例占位值。",
    );
  }
}

function smtpSettings() {
  const development = process.env.NODE_ENV !== "production";
  const host = process.env.SMTP_HOST?.trim() || (development ? "localhost" : "");
  if (!host) throw new Error("SMTP_HOST 未配置，无法发送邮件。");

  const port = Number(process.env.SMTP_PORT || (development ? 1025 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT 配置无效。");
  }

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: user && pass ? { user, pass } : undefined,
  };
}

async function sendAccountEmail(input: {
  to: string;
  subject: string;
  heading: string;
  url: string;
}) {
  const transport = nodemailer.createTransport(smtpSettings());
  const from =
    process.env.SMTP_FROM?.trim() || "Midjourney Prompt <no-reply@localhost>";
  const safeHeading = escapeHtml(input.heading);
  const safeUrl = escapeHtml(input.url);

  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: `${input.heading}\n\n${input.url}\n\n如果不是你本人操作，请忽略此邮件。`,
    html: `<main style="font-family:system-ui,sans-serif;line-height:1.6;color:#15132b"><h1 style="font-size:22px">${safeHeading}</h1><p><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#7157f6;color:#fff;text-decoration:none">继续操作</a></p><p style="color:#666;font-size:13px">如果不是你本人操作，请忽略此邮件。</p></main>`,
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export const auth = betterAuth({
  appName: "Midjourney Prompt",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET || BUILD_ONLY_SECRET,
  database: drizzleAdapter(lazyDb, {
    provider: "pg",
    schema,
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.ALLOW_SIGNUP === "false",
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user: accountUser, url }) => {
      await sendAccountEmail({
        to: accountUser.email,
        subject: "重置你的密码",
        heading: "重置 Midjourney Prompt 密码",
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user: accountUser, url }) => {
      await sendAccountEmail({
        to: accountUser.email,
        subject: "验证你的邮箱",
        heading: "验证 Midjourney Prompt 邮箱",
        url,
      });
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user: accountUser, url }) => {
        await sendAccountEmail({
          to: accountUser.email,
          subject: "确认删除账号",
          heading: "确认删除 Midjourney Prompt 账号",
          url,
        });
      },
    },
  },
  advanced: {
    cookiePrefix: "mj_prompt",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type AuthSession = typeof auth.$Infer.Session;
