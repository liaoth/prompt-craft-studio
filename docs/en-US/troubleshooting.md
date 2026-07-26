# Troubleshooting

[Home](../../README_EN.md) · [Configuration](configuration.md) · [Deployment](deployment.md)

Collect status first:

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 migrate
curl -i http://localhost:3000/api/health
```

## The app does not start

### Invalid `BETTER_AUTH_SECRET`

Do not use the placeholder from `.env.example`. It must have at least 32 characters:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Invalid `APP_ENCRYPTION_KEY`

It must be a base64-encoded 32-byte value or 64 hexadecimal characters. A normal 32-character password is not sufficient.

### Database connection failed

- Docker uses `DOCKER_DATABASE_URL`, where the host must be `postgres`.
- `POSTGRES_PASSWORD` and the URL password must match.
- URL-encode special characters.
- Inspect `docker compose logs postgres`.

## The migration container exits

Exit code 0 means successful completion. Otherwise inspect:

```bash
docker compose logs migrate
```

Do not delete existing migration files or hand-edit the Drizzle journal. Back up production before remediation.

## No email after sign-up

- Local Docker: open <http://localhost:8025>.
- Direct `npm run dev`: change `SMTP_HOST` to `localhost`.
- Production: verify SMTP host, port, TLS mode, credentials, and `SMTP_FROM`.
- Wrong link domain: fix `APP_URL` and `BETTER_AUTH_URL`, restart, and resend.

## Sign-in still requests verification

Use the latest email; older tokens may be expired. Check system time and `BETTER_AUTH_URL`. After successful verification, clear old site cookies and sign in again.

## AI variants report missing configuration

`AI_PROVIDER_REQUIRED` means there is no active user configuration and `SITE_AI_PROVIDER`, `SITE_AI_MODEL`, and `SITE_AI_API_KEY` do not form a complete shared configuration.

Rule mode still works. Test a provider in **Service configuration** before enabling it.

## Ollama fails or times out

1. Run `ollama list` on the host.
2. Test `curl http://localhost:11434/api/tags`.
3. Docker must use `http://host.docker.internal:11434/v1/chat/completions`.
4. The model must exactly match `ollama list`.
5. Set a non-empty placeholder such as `SITE_AI_API_KEY=ollama`.
6. Slow models can use `SITE_AI_TIMEOUT_MS=120000`.
7. Choose a smaller model if memory is insufficient.

On Linux, also verify Ollama's listen address and firewall access from the Docker bridge.

## LibreTranslate connects but cannot translate Chinese

- The request URL must include `/translate`.
- Check the instance's `/languages` endpoint.
- Set `SHARED_LIBRETRANSLATE_CHINESE_LANGUAGE_CODE` to `zh` or `zh-Hans` as returned.
- A key-enabled instance requires `SHARED_LIBRETRANSLATE_API_KEY`.
- Verify that English and Chinese models are loaded.

## Custom endpoint returns `UNSAFE_ENDPOINT`

A user-defined endpoint must be a public HTTPS host in `CUSTOM_ENDPOINT_HOST_ALLOWLIST` and must not resolve to a private, loopback, or link-local address.

Configure local/private AI and translation services as operator-controlled `SITE_AI_*` or `SHARED_LIBRETRANSLATE_*` services instead of user endpoints.

## A parameter is disabled or omitted

This is compatibility protection. Check:

- model version;
- Midjourney Web or Discord surface;
- image or video task;
- required image references;
- conflicts with other parameters.

Unsupported values are disabled and filtered from the final prompt. Open the help popover for the current reason and official documentation.

## Discord receives text but no image appears

This is expected. A Discord webhook posts ordinary messages. It cannot act as a user to execute slash commands and cannot trigger the Midjourney bot. Copy the full prompt and use it manually in Midjourney Web or the official Discord interaction.

## `.env` changes do not apply

Recreate the app container:

```bash
docker compose up -d --force-recreate app
```

If the change affects the image:

```bash
docker compose up --build -d
```

## Port already in use

Change `.env`:

```dotenv
APP_PORT=3001
```

Recreate the app and open `http://localhost:3001`. Update `APP_URL` and `BETTER_AUTH_URL` too.

## Completely reset local data

This permanently deletes the database volume and is only appropriate for disposable local environments:

```bash
docker compose down -v
docker compose up --build -d
```

Never use this as a production troubleshooting step.
