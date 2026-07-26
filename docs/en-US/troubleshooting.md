# Troubleshooting

## The client does not start

Inspect `workspace/desktop.log` in the application-data directory. Confirm that the directory is writable and security software has not quarantined the app. Restart without deleting `prompt-craft.db` or `local.key`.

## Windows SmartScreen

Development packages are currently unsigned. Use only artifacts from the trusted repository or CI, verify the file hash, and continue only if expected. Configure code signing before public distribution.

## AppImage does not run

```bash
chmod +x Prompt-Craft-Studio-*.AppImage
./Prompt-Craft-Studio-*.AppImage
```

Some distributions require FUSE. Use the `.deb` package as an alternative.

## Database or migration failure

Close every app instance, back up the complete `workspace`, and verify write permission and free disk space. Do not run two versions against the same directory. Restore the database and key together.

## Provider connection test fails

1. Use `127.0.0.1` for a service on this computer, not a Docker or LAN address.
2. Public endpoints must use HTTPS.
3. Check model name, API key, proxy, and provider quota.
4. Start Ollama locally and pull the selected model first.
5. LibreTranslate commonly uses the `/translate` path.

## Credentials cannot be decrypted

`local.key` probably does not match the database. Restore the key that was backed up with that database. Without it, delete and recreate the affected provider configuration.

## Port 3000 is busy in source mode

Stop the process using the port, or pass another port to Next.js for source-only debugging. The packaged desktop app automatically selects a free loopback port.

## Reset local data

Back up first. With the app fully closed, move the complete `workspace` to a clearly named backup directory. The next launch creates a new workspace. Do not permanently delete the backup until it is no longer needed.
