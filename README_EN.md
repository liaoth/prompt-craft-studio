# Prompt Craft Studio

A private, local bilingual Midjourney prompt workspace. The Windows and Linux clients require no account, Docker, PostgreSQL, or environment variables, and keep application data on the local machine.

[中文](README.md)

## Features

- Chinese/English prompt composition, structured fields, parameters, and presets.
- History, favorites with revisions, folders, and personal phrases.
- Optional OpenAI-compatible AI, Ollama, translation, and text-push services.
- Local SQLite persistence with AES-256-GCM credential encryption.
- Electron desktop clients for Windows x64 and Linux x64.

## Install the client

Choose an artifact for your platform:

- Windows: installer `*.exe` or portable `*.exe`.
- Linux: `*.AppImage` or `*.deb`.

The first launch creates the database, applies migrations, generates a local encryption key, and opens the workspace. Windows artifacts are currently unsigned and may trigger a SmartScreen warning.

See [Quick start](docs/en-US/quick-start.md) and [Desktop builds](docs/en-US/deployment.md).

## Run from source

Node.js 22.13+ is required:

```bash
npm install
npm run desktop:dev
```

To run only the local web application:

```bash
npm run dev
```

It listens at <http://127.0.0.1:3000>. For a local production server:

```bash
npm run build
npm start
```

No required environment variables are used.

## Package

Native dependencies must be packaged on their target operating system:

```bash
# Windows
npm run dist:win

# Linux
npm run dist:linux
```

Artifacts are written to `release/`. A manually triggered GitHub Actions workflow builds on native Windows and Linux runners.

## Data and backup

Close the application, then copy both:

- `prompt-craft.db`
- `local.key`

The desktop client stores these in the `workspace` child of the OS application-data directory. Source runs use the repository's `data/` directory. A database without its matching key cannot decrypt saved API credentials.

## Security boundary

- The embedded server listens only on `127.0.0.1`.
- Local `localhost`, `127.0.0.1`, and `::1` services and public HTTPS services are allowed.
- Private LAN endpoints and cross-site writes are rejected.
- This is a personal local application and must not be exposed directly to a LAN or the public internet.

More documentation:

- [Configuration](docs/en-US/configuration.md)
- [User guide](docs/en-US/user-guide.md)
- [Troubleshooting](docs/en-US/troubleshooting.md)
- [Security](SECURITY.md)

## Quality commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## License

MIT
