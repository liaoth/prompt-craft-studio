# Quick start

## Packaged client

Use the installer or portable `.exe` on Windows and an `.AppImage` or `.deb` on Linux. No account or configuration is required. On first launch the app:

1. Creates a `workspace` under the OS application-data directory.
2. Generates `local.key`.
3. Creates and migrates `prompt-craft.db`.
4. Starts an embedded service on a random `127.0.0.1` port.
5. Opens the personal workspace.

For an AppImage:

```bash
chmod +x Prompt-Craft-Studio-*.AppImage
./Prompt-Craft-Studio-*.AppImage
```

For Debian or Ubuntu:

```bash
sudo apt install ./Prompt-Craft-Studio-*.deb
```

## Source development

Install Node.js 22.13+, then run:

```bash
npm install
npm run desktop:dev
```

To start only the web app:

```bash
npm run dev
```

Open <http://127.0.0.1:3000>. The `predev` hook initializes local data automatically.

## First use

Rule-based generation works without external services. Open Service Configuration to add and test AI, translation, or text-push services. Settings stay in the local database; there is no site-wide service layer.

## Exit and backup

Close the app and back up both `prompt-craft.db` and `local.key` from the `workspace` directory. Keep the pair together.
