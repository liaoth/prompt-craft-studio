"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  AuthShell,
  authButtonStyle,
  authInputStyle,
  authLabelStyle,
} from "../_components/AuthShell";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const search = useSearchParams();
  const token = search.get("token");
  const invalid = search.get("error") === "INVALID_TOKEN" || !token;
  const [message, setMessage] = useState(
    invalid ? "重置链接无效或已过期，请重新申请。" : "",
  );
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) {
      setBusy(false);
      setMessage("两次输入的密码不一致。");
      return;
    }
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setBusy(false);
    setDone(!result.error);
    setMessage(
      result.error
        ? result.error.message || "重置失败，请重新申请链接。"
        : "密码已更新，现在可以登录。",
    );
  }

  return (
    <AuthShell
      title="设置新密码"
      description="新密码长度需要在 8–128 位之间。"
      footer={
        <Link href={done ? "/signin" : "/forgot-password"}>
          {done ? "前往登录" : "重新申请链接"}
        </Link>
      }
    >
      <form onSubmit={submit}>
        <label style={authLabelStyle}>
          新密码
          <input
            style={authInputStyle}
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            disabled={invalid || done}
            required
          />
        </label>
        <label style={authLabelStyle}>
          确认新密码
          <input
            style={authInputStyle}
            name="confirmPassword"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            disabled={invalid || done}
            required
          />
        </label>
        {message && <p role="status">{message}</p>}
        <button
          style={authButtonStyle}
          disabled={busy || invalid || done}
        >
          {busy ? "更新中…" : "更新密码"}
        </button>
      </form>
    </AuthShell>
  );
}
