import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync } from "node:fs";

import { localEncryptionKeyPath } from "@/lib/local-paths";

const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;

function encryptionKey(raw?: string): Buffer {
  const value = (
    raw ?? readFileSync(localEncryptionKeyPath(), "utf8")
  ).trim();
  if (/^[a-fA-F0-9]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  throw new Error(
    "本地加密密钥必须是 64 位十六进制或 Base64 编码的 32 字节密钥。",
  );
}

export function encryptSecret(plaintext: string, rawKey?: string): string {
  if (!plaintext) throw new Error("不能加密空数据。");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(rawKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(envelope: string, rawKey?: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] =
    envelope.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !ivEncoded ||
    !tagEncoded ||
    !ciphertextEncoded ||
    extra
  ) {
    throw new Error("加密数据格式无效。");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("加密数据格式无效。");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(rawKey),
      iv,
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("凭据解密失败");
  }
}

export function maskSecret(secret: string): string {
  const visible = secret.trim().slice(-4);
  return visible ? `••••••••${visible}` : "••••••••";
}

export function secretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
