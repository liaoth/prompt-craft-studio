import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const PRESET_HOSTS = new Set([
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.deepseek.com",
  "dashscope.aliyuncs.com",
  "ark.cn-beijing.volces.com",
  "open.bigmodel.cn",
  "api.moonshot.cn",
  "api.minimax.io",
  "libretranslate.com",
  "api-free.deepl.com",
  "api.deepl.com",
  "translation.googleapis.com",
]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const MAX_UPSTREAM_RESPONSE_BYTES = 64 * 1024;

export type EndpointValidationOptions = {
  development?: boolean;
  resolveDns?: boolean;
  /**
   * Allows an already-saved legacy public HTTP endpoint to keep working.
   * New configuration writes must continue to use public HTTPS.
   */
  allowInsecureRemote?: boolean;
};

export async function validateEndpointUrl(
  rawUrl: string,
  options: EndpointValidationOptions = {},
): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");

  if (
    url.username ||
    url.password ||
    !hostname ||
    (url.protocol !== "https:" && url.protocol !== "http:")
  ) {
    return false;
  }

  if (PRESET_HOSTS.has(hostname)) {
    return url.protocol === "https:";
  }

  if (LOCAL_HOSTS.has(hostname)) {
    return url.protocol === "http:" || url.protocol === "https:";
  }

  // Remote custom endpoints normally require TLS. A legacy saved endpoint may
  // opt into HTTP, but it still must resolve to a public address.
  if (url.protocol !== "https:" && !options.allowInsecureRemote) return false;

  if (isIP(hostname)) return isPublicIp(hostname);
  if (options.resolveDns === false) return true;

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return (
      addresses.length > 0 &&
      addresses.every((address) => isPublicIp(address.address))
    );
  } catch {
    return false;
  }
}

export function isPublicIp(address: string): boolean {
  const normalized = address
    .toLowerCase()
    .split("%")[0]
    .replace(/^\[|\]$/g, "");
  const version = isIP(normalized);
  if (version === 4) return isPublicIpv4(normalized);
  if (version !== 6) return false;

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  ) {
    return false;
  }

  if (normalized.startsWith("::ffff:")) {
    const mapped = mappedIpv4(normalized.slice("::ffff:".length));
    return mapped ? isPublicIpv4(mapped) : false;
  }

  return true;
}

function mappedIpv4(value: string): string | undefined {
  if (isIP(value) === 4) return value;
  const halves = value.split(":");
  if (halves.length !== 2) return undefined;
  const high = Number.parseInt(halves[0], 16);
  const low = Number.parseInt(halves[1], 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return undefined;
  }
  return [
    high >> 8,
    high & 0xff,
    low >> 8,
    low & 0xff,
  ].join(".");
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b] = octets;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && octets[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    a >= 224
  );
}

export const safeProviderFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    redirect: "error",
  });

export async function readLimitedResponseText(
  response: Response,
  limit = MAX_UPSTREAM_RESPONSE_BYTES,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = await response.text();
    return fallback.length > limit ? `${fallback.slice(0, limit)}...` : fallback;
  }

  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return `${text}...`;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return text;
}

export function maskEndpoint(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}/*`;
  } catch {
    return "***";
  }
}

export async function validateMidjourneyEndpointUrl(
  rawUrl: string,
  options: EndpointValidationOptions = {},
): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (
    (hostname === "discord.com" || hostname.endsWith(".discord.com")) &&
    url.protocol === "https:" &&
    /\/api\/webhooks\//.test(url.pathname)
  ) {
    return true;
  }
  if (hostname.includes("discord")) return false;

  return validateEndpointUrl(rawUrl, options);
}

export async function validateAiEndpointUrl(
  endpoint: string,
): Promise<boolean> {
  return validateEndpointUrl(endpoint);
}

export async function validateTranslationEndpointUrl(
  endpoint: string,
  options: EndpointValidationOptions = {},
): Promise<boolean> {
  return validateEndpointUrl(endpoint, options);
}
