import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");
  const fallbackUrl = process.env.APP_URL || "http://localhost:3000";
  const origin = host ? `${protocol}://${host}` : fallbackUrl;
  const imageUrl = new URL("/og.png", origin).toString();
  const title = "Prompt Craft Studio · Midjourney 提示词工作台";
  const description =
    "用结构化编辑、参数校验、个人素材库和配置入口推送，把灵感整理成可复用的 Midjourney 提示词。";

  return {
    metadataBase: new URL(origin),
    title: {
      default: title,
      template: "%s · Prompt Craft Studio",
    },
    description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
