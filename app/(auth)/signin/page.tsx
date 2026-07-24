"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  AuthShell,
  authButtonStyle,
  authInputStyle,
  authLabelStyle,
} from "../_components/AuthShell";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: "/",
    });
    setBusy(false);
    if (result.error) {
      setMessage(
        result.error.status === 403
          ? "请先查收邮件并完成邮箱验证。"
          : result.error.message || "登录失败，请检查邮箱和密码。",
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell
      title="登录"
      description="登录后同步常用词、历史和收藏。"
      footer={
        <>
          还没有账号？ <Link href="/signup">立即注册</Link>
          <span style={{ margin: "0 8px" }}>·</span>
          <Link href="/forgot-password">忘记密码</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <label style={authLabelStyle}>
          邮箱
          <input
            style={authInputStyle}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <label style={authLabelStyle}>
          密码
          <input
            style={authInputStyle}
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {message && <p role="alert">{message}</p>}
        <button style={authButtonStyle} disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
    </AuthShell>
  );
}
