# Dependency Registry

| Dependency | Purpose | Trust boundary / notes |
| --- | --- | --- |
| Next.js / React / vinext | Full-stack UI and deployable worker runtime | Server routes remain authoritative |
| Better Auth | Email/password sessions, verification, reset | Uses secure HTTP-only session cookies |
| PostgreSQL / pg / Drizzle | Durable user-owned product data | Parameterized queries and migrations only |
| Nodemailer | SMTP verification and reset emails | Credentials come only from environment variables |
| Zod | API and provider response validation | Rejects malformed/unbounded payloads |
| LibreTranslate / DeepL / Google | Optional translation providers | Outbound requests are timed out and endpoint-validated |
| OpenAI / Anthropic / Gemini-compatible APIs | Optional user-configured Prompt generation | User keys encrypted at rest; response schema validated |
| Discord Webhooks / custom HTTPS submission endpoints | Optional Prompt text handoff (not an official Midjourney task API) | Exact Discord host/path validation or operator allowlist; redirects denied; endpoint and credentials encrypted at rest; response stored only as a bounded metadata summary |
| Lucide React | UI icons | No remote asset execution |
| Vitest | Unit and integration-oriented tests | Development-only |

No GPL-licensed runtime component is linked into the application. LibreTranslate runs as an optional isolated container.

The install step applies a narrow vinext Windows compatibility patch that normalizes static-cache paths to URL separators. The patch fails closed if vinext changes its target implementation.
