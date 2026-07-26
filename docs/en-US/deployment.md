# Production deployment

[Home](../../README_EN.md) · [Configuration](configuration.md) · [Troubleshooting](troubleshooting.md)

Recommended topology:

```text
Internet
  -> HTTPS reverse proxy (Nginx / Caddy / cloud load balancer)
  -> 127.0.0.1:3000 Prompt Craft Studio
  -> PostgreSQL on a private Docker network
```

Compose does not publish PostgreSQL and binds the app and Mailpit to `127.0.0.1`.

## Server requirements

- 64-bit Linux; start with 2 vCPU, 4 GB RAM, and 20 GB free disk.
- Docker Engine and Compose v2.
- A domain pointing to the server.
- A working SMTP provider.
- A firewall that exposes only SSH, HTTP, and HTTPS.

AI, LibreTranslate, and Ollama resource requirements are additional.

## First deployment

```bash
git clone https://github.com/liaoth/prompt-craft-studio.git
cd prompt-craft-studio
cp .env.example .env
```

Set at least these production values:

```dotenv
NODE_ENV=production
APP_URL=https://prompt.example.com
BETTER_AUTH_URL=https://prompt.example.com
APP_PORT=3000

BETTER_AUTH_SECRET=independent-random-value
APP_ENCRYPTION_KEY=another-independent-random-value

POSTGRES_DB=promptforge
POSTGRES_USER=promptforge
POSTGRES_PASSWORD=strong-database-password
DOCKER_DATABASE_URL=postgresql://promptforge:URL-encoded-password@postgres:5432/promptforge

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASSWORD=SMTP-password
SMTP_FROM=Prompt Craft <noreply@example.com>
```

Start and verify:

```bash
docker compose up --build -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

The `migrate` service should exit successfully, and `postgres` and `app` should be healthy.

## Nginx example

```nginx
server {
    listen 80;
    server_name prompt.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name prompt.example.com;

    ssl_certificate     /etc/letsencrypt/live/prompt.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prompt.example.com/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

When the proxy and app share a host and the app binds loopback, there is normally no need to trust arbitrary public proxy headers. With a separate proxy node or load balancer, first restrict the origin to that proxy with firewall/security-group rules, then place its exact IP/CIDR in `BETTER_AUTH_TRUSTED_PROXIES`.

## Caddy example

```caddy
prompt.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy automatically obtains and renews TLS certificates.

## Production email checklist

Mailpit is not a production mail server. Before launch:

1. Register with a real email address.
2. Confirm delivery and the domain in the verification link.
3. Test password reset.
4. Inspect the SMTP provider for bounces.

To close public registration:

```dotenv
ALLOW_SIGNUP=false
```

Create required accounts before disabling sign-up.

## Data backup

Create a logical backup before updates:

```bash
mkdir -p backups
docker compose exec -T postgres \
  pg_dump -U promptforge -d promptforge -Fc \
  > "backups/promptforge-$(date +%Y%m%d-%H%M%S).dump"
```

The backup directory is ignored by Git. Copy backups to a different machine or object store and test restoration periodically.

## Update

```bash
git fetch origin
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

`docker compose up` waits for PostgreSQL, applies migrations, and then starts the app. Do not force-start the app after a failed migration. Inspect:

```bash
docker compose logs migrate
```

## Logs and monitoring

```bash
docker compose logs -f --tail=200 app
docker compose logs -f --tail=100 postgres
docker compose ps
docker stats
```

Have an external monitor request `/api/health` every 30–60 seconds. Alert on disk space, the PostgreSQL volume, and SMTP failures.

## Security checklist

- Restrict `.env` to the deployment account.
- Do not expose ports 3000, 8025, 5432, 11434, or LibreTranslate to the Internet.
- Serve HTTPS only; production cookies depend on HTTPS.
- Use different credentials for database, auth, encryption, SMTP, and external APIs.
- Keep `CUSTOM_ENDPOINT_HOST_ALLOWLIST` minimal.
- Never trust arbitrary `X-Forwarded-For` values or an entire private subnet as a proxy.
- Review changes, run all tests, and back up before dependency or image updates.
- Account deletion cascades through business configurations; database backups remain subject to your backup retention policy.
