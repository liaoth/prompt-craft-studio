# Configuration

The local edition has no required environment variables and no `.env.example`. Everyday settings are stored from the client's Service Configuration screen.

## Data location

Typical desktop locations:

- Windows: `%APPDATA%\prompt-craft-studio\workspace`
- Linux: `~/.config/prompt-craft-studio/workspace`

The exact parent is Electron's `userData` path. Source runs use the repository's `data/`.

The directory contains:

- `prompt-craft.db`: history, favorites, folders, phrases, and service settings.
- `local.key`: the key used to encrypt service credentials.
- `desktop.log`: desktop and embedded-server startup logs.

## AI services

OpenAI, DeepSeek, Anthropic, Gemini, Moonshot, OpenRouter, Groq, Ollama, and OpenAI-compatible endpoints are supported. Enter a name, endpoint, model, and API key, then test the connection.

Ollama example:

```text
Endpoint: http://127.0.0.1:11434/v1/chat/completions
Model: qwen2.5:7b
API Key: ollama
```

## Translation

DeepL, Google, Microsoft, OpenAI-compatible models, and LibreTranslate are supported. A local LibreTranslate endpoint is typically:

```text
http://127.0.0.1:5000/translate
```

## Text push

Use a Discord webhook or a custom HTTP target. Discord is restricted to its official webhook hosts and paths. Custom services must use public HTTPS or a loopback address.

## Network rules

- `http://localhost:*`, `http://127.0.0.1:*`, and `http://[::1]:*` may reach local services.
- Public services require HTTPS.
- Private LAN, link-local, and cloud metadata addresses are rejected.
- LAN sharing is not supported.

## Internal variables

`PROMPT_CRAFT_DATA_DIR` and `PROMPT_CRAFT_MIGRATIONS_DIR` exist only for packaged runtime and automated tests. They are not user configuration interfaces.
