# Execution board

## Objective

Deliver `feat/local-standalone`: a single-user local SQLite application and Electron client for Windows/Linux, with no login, Docker, PostgreSQL, or required environment variables.

## Completed

| Work item | Evidence |
| --- | --- |
| Create branch from clean `main` | `feat/local-standalone` created from `8768335` |
| Replace PostgreSQL with SQLite/libSQL | Drizzle schema and initial migration; `data/prompt-craft.db` |
| Automatic first-run setup | `scripts/prepare-local-data.mjs` creates data directory, key, and migrations |
| Remove authentication and shared services | Auth pages/API and `/api/site-services` deleted; local workspace is always available |
| Remove Docker/Vinext/Cloudflare/Sites configuration | Deployment chain is standard Next.js plus Electron |
| Add desktop shell | `electron/main.cjs`, hardened BrowserWindow, embedded standalone server |
| Add Windows/Linux packaging | electron-builder NSIS/portable/AppImage/deb targets and native-runner workflow |
| Preserve local business APIs | History, favorites, revisions, folders, phrases, provider configs, health |
| Add local security boundaries | Loopback server, private-address rejection, same-origin write checks |
| Rewrite bilingual documentation | Install, source development, data backup, providers, packaging, and troubleshooting |

## Validation gate

Run before commit:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run db:migrate
```

Also verify:

- first launch from an empty temporary data directory creates `prompt-craft.db` and `local.key`;
- restart preserves local data;
- `/api/health` reports `storage: "sqlite"`;
- loopback services work, LAN/private endpoints fail, and cross-site writes fail;
- unpacked Electron package contains standalone server, migrations, and native libSQL modules;
- Windows artifacts build on Windows and Linux artifacts build on Linux.

## Delivery

Commit message: `feat: add standalone local deployment`.

Push the branch to `origin/feat/local-standalone`; do not create a pull request.
