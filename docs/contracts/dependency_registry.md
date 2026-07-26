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
| Ollama OpenAI-compatible API | Optional operator-configured local Prompt generation | Exact `SITE_AI_ENDPOINT` match may use the host gateway/private Docker network; user-controlled private endpoints remain blocked |
| Discord Webhooks / custom HTTPS submission endpoints | Optional Prompt text handoff (not an official Midjourney task API) | Exact Discord host/path validation or operator allowlist; redirects denied; endpoint and credentials encrypted at rest; response stored only as a bounded metadata summary |
| Lucide React | UI icons | No remote asset execution |
| dnd-kit core / sortable / utilities | Accessible shared drag-and-drop for Prompt blocks and phrase snippets | One workbench-level context supports phrase copy and block moves; persisted block payloads are validated server-side |
| Vitest | Unit and integration-oriented tests | Development-only |

No GPL-licensed runtime component is linked into the application. LibreTranslate runs as an optional isolated container.

The install step applies a narrow vinext Windows compatibility patch that normalizes static-cache paths to URL separators. The patch fails closed if vinext changes its target implementation.

The default phrase library, its deterministic section-12 extraction script, the drag overlay, the portal-backed control help, and the image-command assistant use existing platform/runtime dependencies only. No new runtime package was introduced. Arbitrary image URLs are never fetched on the server.

The merged bilingual token editor, keyboard deletion, per-block translation protection and V4 snapshot compatibility use React and the existing translation endpoint; no rich-text or token-editor dependency was added.

Batch record management and provider-specific setup guidance use the existing Drizzle, Zod, React, and Lucide dependencies. No new runtime dependency or external help-content API was added.

The aspect-ratio adapter, registry-driven number stepper, parameter token editor, negative-block reconciliation and graphite theme use existing React, Lucide and prompt-domain modules. No new package, database table or migration was introduced.

The bilingual public documentation, Linux host-gateway mapping and release metadata introduce no runtime dependency.
