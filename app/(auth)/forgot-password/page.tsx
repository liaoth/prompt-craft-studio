"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  AuthShell,
  authButtonStyle,
  authInputStyle,
  authLabelStyle,
} from "../_components/AuthShell";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const result = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    setBusy(false);
    setMessage(
      result.error
        ? result.error.message || "发送失败，请稍后重试。"
        : "如果该邮箱已注册，重置邮件将很快送达。",
    );
  }

  return (
    <AuthShell
      title="找回密码"
      description="输入注册邮箱，我们会发送一次性重置链接。"
      footer={<Link href="/signin">返回登录</Link>}
    >
      <form onSubmit={submit}>
        <label style={authLabelStyle}>
          邮箱
          <input
            style={authInputStyle}
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            required
          />
        </label>
        {message && <p role="status">{message}</p>}
        <button style={authButtonStyle} disabled={busy}>
          {busy ? "发送中…" : "发送重置邮件"}
        </button>
      </form>
    </AuthShell>
  );
}
