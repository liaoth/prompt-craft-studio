# Prompt Craft Studio

[中文](README.md) · [Quick start](docs/en-US/quick-start.md) · [Configuration](docs/en-US/configuration.md) · [User guide](docs/en-US/user-guide.md) · [Deployment](docs/en-US/deployment.md) · [Troubleshooting](docs/en-US/troubleshooting.md)

A self-hosted bilingual Midjourney prompt workspace that combines natural-language ideation, structured color-coded blocks, parameter validation, image references, history, and a reusable work library in one responsive UI.

> [!IMPORTANT]
> This is not an official Midjourney product and it does not create Midjourney image jobs. “Send to configured endpoint” only forwards text to a Discord webhook or a custom HTTP endpoint.

![Prompt Craft Studio](public/og.png)

## Highlights

- Deterministic rule generation or three AI variants: concise, detailed, and experimental.
- Linked Chinese/English token editing with per-block translation and protection for manually edited English.
- Structured groups for subject, action, environment, composition, camera, lighting, color, material, medium, style, mood, and negative content.
- 642 built-in read-only phrases, personal snippets, full search, filtering, and cross-group drag and drop.
- Ten scenario templates and a data-driven Midjourney parameter panel.
- Unsupported parameters are disabled by model, Web/Discord surface, and image/video task, and are excluded from the final prompt.
- Image, Style Reference, Omni Reference, and video-frame URLs plus Imagine, Describe, Blend, and Video helpers.
- Up to 100 deduplicated history records per user; unlimited favorites, folders, and immutable revisions.
- TXT, Markdown, and JSON export plus batch deletion.
- Better Auth email registration/verification/password reset with PostgreSQL and Drizzle.
- Per-user AI, translation, and text-forwarding settings. Secrets are encrypted with AES-256-GCM and only masked values are returned.
- Docker Compose starts PostgreSQL, migrations, the app, and Mailpit; LibreTranslate is optional.

## Fastest setup

Requirements: Docker Engine or Docker Desktop with Compose v2. At least 4 GB of available memory is recommended.

```bash
git clone https://github.com/liaoth/prompt-craft-studio.git
cd prompt-craft-studio
cp .env.example .env
```

Edit `.env` and replace at least:

- `POSTGRES_PASSWORD`
- the matching, URL-encoded password in `DOCKER_DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `APP_ENCRYPTION_KEY`

Generate two independent random secrets by running this command twice:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Start the stack:

```bash
docker compose up --build -d
docker compose ps
```

Open:

- App: <http://localhost:3000>
- Development mailbox: <http://localhost:8025>
- Health endpoint: <http://localhost:3000/api/health>

After signing up, open the verification email in Mailpit before signing in. Rule mode works without any AI or translation provider. See the [quick-start guide](docs/en-US/quick-start.md) for the complete walkthrough.

## Configuration map

| Need | Configure it here |
| --- | --- |
| PostgreSQL, auth secrets, SMTP, proxies | `.env`; see [Configuration](docs/en-US/configuration.md) |
| Shared AI or Ollama | `SITE_AI_*` in `.env` |
| Shared LibreTranslate | `SHARED_LIBRETRANSLATE_*` in `.env` |
| A user's own AI or translation provider | Sign in and open **Service configuration** |
| Discord webhook or custom HTTP forwarding | **Service configuration → Text forwarding** |
| Domain, HTTPS, reverse proxy | [Deployment guide](docs/en-US/deployment.md) |

Resolution order:

1. The current user's active AI/translation configuration.
2. The site-wide service configured by the operator.
3. Translation failures preserve the source text with a warning. AI three-variant generation returns a clear configuration error; deterministic rule mode remains available.

## Local development

Requirements: Node.js 22.13+ and PostgreSQL 15+.

```bash
npm ci
npm run db:migrate
npm run dev
```

Quality gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Stack

Next.js / Vinext, React, TypeScript, PostgreSQL, Drizzle ORM, Better Auth, Zod, Vitest, and Docker Compose.

## Security and data

- Never commit `.env`, database backups, or real API keys.
- Changing `APP_ENCRYPTION_KEY` makes previously saved user provider credentials unreadable.
- Custom outbound endpoints are protected by HTTPS, host allowlisting, DNS checks, and private-network rejection.
- Back up PostgreSQL before production migrations. A normal `docker compose down` does not delete the database volume.
- See [SECURITY.md](SECURITY.md) for reporting guidance.

## License

[MIT](LICENSE). Midjourney names and trademarks belong to their respective owners.
