# Quick start

[Home](../../README_EN.md) · [Configuration](configuration.md) · [User guide](user-guide.md)

This guide starts the complete development stack with Docker Compose: PostgreSQL, database migrations, the app, and the Mailpit mailbox.

## 1. Prerequisites

- Windows/macOS: Docker Desktop with Compose v2.
- Linux: Docker Engine with the Compose plugin.
- Git.
- At least 4 GB of available memory is recommended. Ollama or LibreTranslate needs additional memory.

Verify the tools:

```bash
docker --version
docker compose version
git --version
```

## 2. Get the source

```bash
git clone https://github.com/liaoth/prompt-craft-studio.git
cd prompt-craft-studio
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

## 3. Set required variables

Run this command twice to produce two independent random values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set these values in `.env`:

```dotenv
BETTER_AUTH_SECRET=first-random-value
APP_ENCRYPTION_KEY=second-random-value
POSTGRES_PASSWORD=a-new-database-password
DOCKER_DATABASE_URL=postgresql://promptforge:URL-encoded-password@postgres:5432/promptforge
```

Characters such as `@`, `:`, `/`, and `#` must be URL-encoded inside `DOCKER_DATABASE_URL`. To encode a password:

```bash
node -e "console.log(encodeURIComponent(process.argv[1]))" "your database password"
```

## 4. Start the stack

```bash
docker compose up --build -d
docker compose ps
```

`postgres`, `migrate`, `app`, and `mailpit` should complete or become healthy. It is normal for the migration container to exit after a successful run.

Follow app logs:

```bash
docker compose logs -f app
```

## 5. Sign up and verify

1. Open <http://localhost:3000>.
2. Register an email account.
3. Open <http://localhost:8025>.
4. Open the newest verification email and follow its link.
5. Return to the app and sign in.

Mailpit is for local development only and does not deliver mail to real inboxes.

## 6. Generate your first prompt

1. Keep **Rule mode** selected.
2. Enter a Chinese idea.
3. Apply a template or drag phrases into structured groups.
4. Set the model, aspect ratio, and other parameters.
5. Select **Generate Prompt**.
6. Copy the full prompt or save it as a work.

Rule mode does not require an AI key. Continue with [Configuration](configuration.md) to enable AI variants and automatic translation.

## 7. Stop and update

Stop while preserving data:

```bash
docker compose down
```

Update:

```bash
git pull --ff-only
docker compose up --build -d
```

Back up production PostgreSQL before updating. Do not run `docker compose down -v` unless you intentionally want to delete the database volume permanently.
