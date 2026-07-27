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

The client uses a long-lived `desktop` branch; the default `main` branch does not need to contain the desktop source. When a `desktop-v*` tag pointing to a `desktop` commit is pushed, `.github/workflows/desktop-build.yml`:

1. Tests and packages on native Windows and Linux runners.
2. Uploads short-lived Actions artifacts for build diagnostics.
3. Collects the packages and generates `SHA256SUMS.txt`.
4. Creates a public [GitHub Release](https://github.com/liaoth/prompt-craft-studio/releases) that anyone can download.

For example, to publish `1.0.0`:

```bash
git switch desktop
git tag -a desktop-v1.0.0 -m "Prompt Craft Studio 1.0.0"
git push origin desktop
git push origin desktop-v1.0.0
```

The release tag points directly to the client branch; the client source does not need to be merged into `main`.

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
