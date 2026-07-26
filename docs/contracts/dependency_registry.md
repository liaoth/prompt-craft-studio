# Dependency registry

| Dependency | Role | Boundary |
| --- | --- | --- |
| Next.js / React | Web UI and local API server | Standalone output is embedded in the desktop client |
| Electron | Windows/Linux desktop shell | Context isolation, sandbox, no Node integration in renderer |
| electron-builder | NSIS/portable Windows and AppImage/deb Linux packaging | Builds on native target runners |
| Drizzle ORM / SQLite libSQL | Durable local workspace data | Checked-in SQLite migrations only |
| Node.js 22 | Runtime and build toolchain | Required for source development and packaging |
| Zod | API and configuration validation | Rejects invalid payloads and unsafe endpoint settings |
| Vitest | Unit and boundary regression tests | Runs without external services |

Removed deployment-only dependencies include Better Auth, PostgreSQL/`pg`, SMTP/Nodemailer, Vinext, Cloudflare Worker/Sites adapters, Docker Compose, and site-shared service APIs.

Optional provider SDKs are not bundled. The app calls user-configured HTTP endpoints and never reads provider secrets from required environment variables.
