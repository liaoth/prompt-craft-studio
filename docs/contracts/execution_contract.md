# Execution contract

Prompt Craft Studio is a single-user, local-first application:

- SQLite in `prompt-craft.db` is the source of truth for the local workspace.
- The fixed local workspace identity is resolved server-side; clients never submit a user id.
- History, favorites, folders, phrases, provider configurations, and revisions use the existing API response shapes.
- Authentication, sessions, account verification, registration, password reset, and site-shared services are intentionally absent.
- AI, translation, and text-push providers are configured per local workspace and secrets are encrypted at rest with `local.key`.
- History is content-deduplicated and bounded to the latest 100 records.
- The embedded server binds to loopback only. Loopback HTTP is allowed for local tools; public custom endpoints require HTTPS and private address ranges are rejected.
- Every API write passes same-origin metadata checks.
- Desktop startup creates the data directory, key, and migrations before launching the standalone Next.js server.
- A backup is valid only when `prompt-craft.db` and `local.key` are copied together.
