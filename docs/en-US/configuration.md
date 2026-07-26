# Configuration

[Home](../../README_EN.md) · [Quick start](quick-start.md) · [Deployment](deployment.md) · [Troubleshooting](troubleshooting.md)

Configuration has two layers:

- **Site configuration** is supplied by the operator through `.env` and acts as a shared fallback.
- **User configuration** is saved from **Service configuration** after sign-in. An active user configuration takes precedence.

API keys, tokens, and private endpoints in user configurations are encrypted with `APP_ENCRYPTION_KEY`. The browser only receives masked values.

## Environment variable reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Yes | Public application root used for page metadata. Use `https://...` in production. |
| `APP_PORT` | Docker optional | Host port, default `3000`. Compose binds it to `127.0.0.1`. |
| `BETTER_AUTH_URL` | Yes | Public Better Auth root, normally identical to `APP_URL`. |
| `BETTER_AUTH_SECRET` | Yes | Random authentication secret with at least 32 characters. |
| `APP_ENCRYPTION_KEY` | Yes | A base64-encoded 32-byte key or 64 hexadecimal characters. |
| `ALLOW_SIGNUP` | Optional | `true` enables registration; `false` blocks new registration. |
| `POSTGRES_*` | Docker required | Database, user, and password used by the PostgreSQL container. |
| `DOCKER_DATABASE_URL` | Docker required | In-container database URL; the host is `postgres`. |
| `DATABASE_URL` | Local dev required | PostgreSQL URL used by direct npm commands. |
| `DB_POOL_MAX` | Optional | Maximum database connections per app process. |
| `SMTP_*` | Yes | Email verification, password reset, and account deletion mail. |
| `SITE_AI_*` | Optional | Shared site-wide AI fallback. |
| `SHARED_LIBRETRANSLATE_*` | Optional | Shared LibreTranslate fallback. |
| `CUSTOM_ENDPOINT_HOST_ALLOWLIST` | Optional | Public custom endpoint hosts users may configure. |
| `BETTER_AUTH_TRUSTED_PROXIES` | Proxy deployments | Exact trusted proxy IP/CIDR values, comma-separated. |
| `BETTER_AUTH_IP_HEADERS` | Proxy deployments | Client-IP header supplied by the proxy; defaults to `x-forwarded-for`. |

Generate a random key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use different generated values for `BETTER_AUTH_SECRET` and `APP_ENCRYPTION_KEY`. Do not casually rotate `APP_ENCRYPTION_KEY` after users have saved provider credentials.

## PostgreSQL

Docker example:

```dotenv
POSTGRES_DB=promptforge
POSTGRES_USER=promptforge
POSTGRES_PASSWORD=replace-with-a-strong-password
DOCKER_DATABASE_URL=postgresql://promptforge:replace-with-a-strong-password@postgres:5432/promptforge
```

URL-encode special characters in the username, password, and database name. The one-shot `migrate` container applies database migrations.

Direct npm development example:

```dotenv
DATABASE_URL=postgresql://promptforge:password@localhost:5432/promptforge
```

## Email and accounts

Local Docker defaults:

```dotenv
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Prompt Craft <noreply@localhost>
```

Production SMTP example:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=Prompt Craft <noreply@example.com>
```

- Port `465` normally uses `SMTP_SECURE=true`.
- Port `587` normally uses STARTTLS and therefore `SMTP_SECURE=false`.
- `APP_URL` and `BETTER_AUTH_URL` must be the public HTTPS URL or links in email will be wrong.
- `ALLOW_SIGNUP=false` blocks new accounts but does not prevent existing users from signing in.

## Shared site AI

Minimum configuration:

```dotenv
SITE_AI_PROVIDER=openai
SITE_AI_MODEL=gpt-4.1-mini
SITE_AI_API_KEY=your-api-key
SITE_AI_ENDPOINT=
SITE_AI_TIMEOUT_MS=45000
```

Supported provider IDs:

| Provider ID | Protocol | When endpoint is blank |
| --- | --- | --- |
| `openai` | OpenAI Chat Completions | OpenAI default |
| `anthropic` | Anthropic Messages | Anthropic default |
| `gemini` | Gemini generateContent | Generated from the model ID |
| `deepseek` | OpenAI compatible | DeepSeek default |
| `qwen` | OpenAI compatible | DashScope Beijing default |
| `doubao` | OpenAI compatible | Volcengine Ark Beijing default |
| `zhipu` | OpenAI compatible | Zhipu default |
| `kimi` | OpenAI compatible | Moonshot default |
| `minimax` | OpenAI compatible | MiniMax default |
| `custom` | OpenAI compatible | Full `/v1/chat/completions` URL is required |

Model IDs change over time. Copy the exact currently available ID from the provider console. `SITE_AI_TIMEOUT_MS` must be an integer from `1` to `120000`.

### Ollama

Install Ollama and pull a model suitable for the host:

```bash
ollama pull qwen2.5:3b
ollama list
```

Docker Desktop to host Ollama:

```dotenv
SITE_AI_PROVIDER=custom
SITE_AI_MODEL=qwen2.5:3b
SITE_AI_API_KEY=ollama
SITE_AI_ENDPOINT=http://host.docker.internal:11434/v1/chat/completions
SITE_AI_TIMEOUT_MS=120000
```

Even when Ollama ignores authentication, a non-empty placeholder is required by the configuration schema. Compose maps `host.docker.internal` to the host gateway on Linux. Linux operators must also make Ollama listen on an address reachable from Docker and firewall port 11434. Never expose an unauthenticated Ollama instance to the public Internet.

Test the local daemon:

```bash
curl http://localhost:11434/api/tags
```

After signing in, use the site-service test in **Service configuration** to test the actual app path. An exact operator-controlled site endpoint may be private; a user-defined endpoint cannot bypass private-network SSRF protection.

## Shared LibreTranslate

Run the bundled optional service:

```bash
docker compose -f compose.yaml -f compose.translation.yaml up --build -d
```

The override configures:

```dotenv
SHARED_LIBRETRANSLATE_URL=http://libretranslate:5000/translate
```

Use an existing instance:

```dotenv
SHARED_LIBRETRANSLATE_URL=https://translate.example.com/translate
SHARED_LIBRETRANSLATE_API_KEY=your-api-key
SHARED_LIBRETRANSLATE_CHINESE_LANGUAGE_CODE=zh-Hans
```

`SHARED_LIBRETRANSLATE_CHINESE_LANGUAGE_CODE` must match the Chinese language code returned by the instance's `/languages` endpoint, commonly `zh` or `zh-Hans`. Leave `SHARED_LIBRETRANSLATE_API_KEY` empty when the instance does not require a key.

Direct test:

```bash
curl -X POST https://translate.example.com/translate \
  -H "Content-Type: application/json" \
  -d '{"q":"The server is ready.","source":"en","target":"zh-Hans","format":"text","api_key":"YOUR_KEY"}'
```

## Per-user AI

After signing in, open **Service configuration → AI model**:

1. Select the provider.
2. Enter an exact model ID that the account can use.
3. Enter the API key.
4. Built-in providers normally leave endpoint blank. A custom OpenAI-compatible service requires the complete request URL.
5. Save, test, and enable the configuration.

Only one configuration is active per user. If a user configuration fails, generation can use the shared site AI. If neither is available, the API returns `AI_PROVIDER_REQUIRED`.

A custom user endpoint must:

- use public HTTPS;
- have its hostname in `CUSTOM_ENDPOINT_HOST_ALLOWLIST`;
- resolve to no loopback, link-local, or private address;
- include the complete path accepted by the service.

## Per-user translation

LibreTranslate, DeepL API, and Google Cloud Translation Basic v2 are supported. Create, test, and enable them under **Service configuration → Translation**.

- LibreTranslate: complete `/translate` URL; key optional.
- DeepL Free: default is `https://api-free.deepl.com/v2/translate`; Pro uses `https://api.deepl.com/v2/translate`.
- Google: use an API key with Cloud Translation API enabled, not a service-account JSON document.

## Text forwarding

### Discord webhook

1. In a Discord server where you have permission, open **Server Settings → Integrations → Webhooks**.
2. Create a webhook, select a channel, and copy the complete URL.
3. Select Discord Webhook in **Service configuration → Text forwarding**.
4. Paste the URL as the endpoint, leave API Key blank, save, and test.

A webhook posts a normal text message. It **does not execute `/imagine` and does not trigger Midjourney rendering**.

### Custom HTTP

The endpoint receives a JSON `POST` containing the prompt, snapshot, and parameters:

1. Prepare a public HTTPS endpoint.
2. Add its hostname to `CUSTOM_ENDPOINT_HOST_ALLOWLIST`.
3. Enter the complete endpoint URL.
4. If the receiver uses a Bearer token, enter it as API Key.
5. Save and test.

## Custom endpoint allowlist

```dotenv
CUSTOM_ENDPOINT_HOST_ALLOWLIST=models.example.com,translate.example.com,hooks.example.com
```

Enter hostnames only: no scheme, path, or wildcard. Built-in providers and `discord.com` webhooks need no entry. Allowlisting never permits a private IP; configure private services as operator-controlled shared services.

## Reverse proxy

Only configure trusted proxies after network policy ensures that the application origin is reachable exclusively through that proxy:

```dotenv
BETTER_AUTH_TRUSTED_PROXIES=172.18.0.10/32
BETTER_AUTH_IP_HEADERS=x-forwarded-for
```

Do not trust an entire private subnet, and do not trust forwarded headers while users can reach the origin directly. See [Deployment](deployment.md) for a complete example.
