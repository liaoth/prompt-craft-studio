# Desktop builds and local deployment

## Supported targets

- Windows x64: NSIS installer and portable executable.
- Linux x64: AppImage and Debian package.

SQLite/libSQL includes native binaries, so package on the target operating system. Node.js 22.13+ is required.

## Windows

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run dist:win
```

## Linux

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run dist:linux
```

Artifacts are written to `release/`. Windows packages are currently unsigned; configure a code-signing certificate in an organizational release workflow before broad distribution.

## GitHub Actions

`.github/workflows/desktop-build.yml` can be dispatched manually and runs for `desktop-v*` tags. Native Windows and Linux runners upload their packages as Actions artifacts.

## Local web mode

```bash
npm ci
npm run build
npm start
```

The server binds to `127.0.0.1:3000`. This is not a server-hosting architecture. Do not change it to `0.0.0.0` and expose it to a network.

## Backup and restore

1. Exit the application completely.
2. Copy both `workspace/prompt-craft.db` and `workspace/local.key`.
3. Restore the pair only while the application is closed.
4. Start the app and verify history, favorites, and service configuration.

The database and key must match. The log does not need to be backed up.
