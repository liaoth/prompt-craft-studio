# Execution Contract

Prompt Craft Studio is a server-authoritative application:

- Browser state may hold an unsaved draft, but PostgreSQL is the source of truth for accounts, phrases, history, favorites, and service configurations.
- API handlers resolve the current Better Auth session and never accept a client-supplied user id.
- The prompt domain is pure and database-independent. API handlers translate validated requests into domain calls and persist successful snapshots.
- Secrets are encrypted before persistence and are never serialized back to the browser.
- Midjourney submissions use the current user's single active configuration, validate the destination against the SSRF policy, and persist success or failure independently from the 100-item Prompt history.
- Deleting a Midjourney provider configuration preserves its prior submission audit records while clearing the configuration reference.
- All schema changes are represented by generated Drizzle migrations.
