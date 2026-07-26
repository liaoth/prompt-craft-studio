import { requireSession } from "@/lib/server/auth";
import {
  resolveAiEndpoint,
  sharedAiConfig,
  sharedAiTimeoutMs,
  sharedTranslationConfig,
} from "@/lib/server/configs";
import { maskEndpoint } from "@/lib/server/endpoints";
import { ok, route } from "@/lib/server/http";

export const GET = route(async (request) => {
  await requireSession(request);
  const ai = sharedAiConfig();
  const translation = sharedTranslationConfig();
  const aiEndpoint = ai ? resolveAiEndpoint(ai) : undefined;

  return ok({
    ai: ai
      ? {
          configured: true,
          service:
            ai.provider === "custom" && looksLikeOllama(aiEndpoint)
              ? "Ollama"
              : ai.provider,
          provider: ai.provider,
          model: ai.model,
          endpoint: maskEndpoint(aiEndpoint ?? ""),
          apiKeyConfigured: Boolean(ai.apiKey),
          timeoutMs: sharedAiTimeoutMs() ?? 45_000,
        }
      : { configured: false },
    translation: translation
      ? {
          configured: true,
          service: "LibreTranslate",
          provider: translation.provider,
          endpoint: maskEndpoint(translation.endpoint ?? ""),
          apiKeyConfigured: Boolean(translation.apiKey),
          chineseLanguageCode:
            translation.chineseLanguageCode ?? "zh",
        }
      : { configured: false },
  });
});

function looksLikeOllama(endpoint?: string): boolean {
  if (!endpoint) return false;
  try {
    const parsed = new URL(endpoint);
    return (
      parsed.port === "11434" ||
      parsed.hostname.toLowerCase().includes("ollama")
    );
  } catch {
    return false;
  }
}
