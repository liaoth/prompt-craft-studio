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

export default function SignUpPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) {
      setBusy(false);
      setMessage("两次输入的密码不一致。");
      return;
    }
    const result = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
      callbackURL: "/",
    });
    setBusy(false);
    setMessage(
      result.error
        ? result.error.message || "注册失败，请稍后重试。"
        : "注册成功，请查收验证邮件后登录。",
    );
  }

  return (
    <AuthShell
      title="创建账号"
      description="注册后可在不同设备同步你的创作资料。"
      footer={
        <>
          已有账号？ <Link href="/signin">返回登录</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <label style={authLabelStyle}>
          昵称
          <input
            style={authInputStyle}
            name="name"
            maxLength={80}
            autoComplete="name"
            required
          />
        </label>
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
        <label style={authLabelStyle}>
          密码（至少 8 位）
          <input
            style={authInputStyle}
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label style={authLabelStyle}>
          确认密码
          <input
            style={authInputStyle}
            name="confirmPassword"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        {message && <p role="status">{message}</p>}
        <button style={authButtonStyle} disabled={busy}>
          {busy ? "提交中…" : "注册"}
        </button>
      </form>
    </AuthShell>
  );
}
