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
| Add public desktop release line | Long-lived `desktop` branch; `desktop-v*` tags publish installers and SHA-256 checksums to GitHub Releases without changing `main` |
| Harden configuration deletion lifecycle | In-app confirmation avoids native-dialog input blocking; delete progress keeps the target row visible and marks only that row busy while other rows and the add form remain interactive |
| Add dedicated local Ollama entry | AI settings expose a one-click Ollama preset with loopback endpoint, model default, and no API key requirement |
| Improve phrase and history interactions | Default/custom phrase categories, consistent controls, history copy, full-group drop targeting, and cursor-aligned drag previews |
| Unify persistent deletion and phrase gestures | History, favorites, folders, phrases, and provider configs use the same in-app confirmation layer; phrase cards expose separate click-to-add and drag-handle controls |
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
