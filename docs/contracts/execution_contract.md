# Execution Contract

Prompt Craft Studio is a server-authoritative application:

- Browser state may hold an unsaved draft, but PostgreSQL is the source of truth for accounts, phrases, history, favorites, and service configurations.
- API handlers resolve the current Better Auth session and never accept a client-supplied user id.
- The prompt domain is pure and database-independent. API handlers translate validated requests into domain calls and persist successful snapshots.
- Prompt snapshots use schema version 4. Image references and per-block bilingual synchronization metadata remain inside existing JSON snapshots; V1–V3 snapshots are upgraded on read and are only persisted as V4 after an explicit save.
- The merged Prompt composer treats bilingual blocks as the only editable body source. Chinese and English tokens share an id, so edits, deletion, copy, export, favorites and handoff cannot drift from the structured editor.
- Structured `negative` blocks are the only editable exclusion source. `parameters.no` is derived from the selected variant immediately before validation, serialization or persistence; legacy V4 snapshots reconcile both representations without duplicating values.
- English Prompt bodies contain positive descriptive blocks only. Human-readable Chinese copy may append an exclusion explanation, while the complete Midjourney Prompt emits one normalized trailing `--no`.
- Aspect-ratio editing is a browser adapter over the existing `width:height` string contract. Incomplete halves are not serialized, and numeric parameters use registry-driven accessible steppers without clamping direct invalid input.
- Parameter availability is resolved from one shared model/surface/task compatibility function. Unsupported controls remain visible but disabled and visually muted; unsupported values are removed from the live Prompt and client payload even when restored from an older snapshot.
- Profile/Moodboard codes remain part of `PromptParameters`, but are edited as ordered, deduplicated color tokens with the existing 20-item and 120-character schema limits.
- Chinese-idea generations enable debounced block-level zh→en synchronization. Manually edited English blocks are protected until the user explicitly requests retranslation; new English-only blocks may be completed en→zh.
- The bundled default phrase library is immutable application data available to guests. Personal phrases remain PostgreSQL-owned, authenticated user data.
- The bundled phrase library keeps the original curated entries first, then deterministically supplements them from sections 12.1–12.11 of the learning source. The source contract is 592 rows and the normalized public library contract is 642 unique entries; production never reads the original F: drive document.
- Phrase search and category filters always operate on the complete 642-entry library. The browser progressively renders 120 results at a time without changing search semantics.
- Prompt blocks and phrase snippets share one drag context. Phrase drags copy into the destination group, while existing Prompt blocks move; both expose an accessible, pointer-following drag overlay.
- Parameter help is a portal-backed interactive surface: it supports hover delay, keyboard focus, click-to-pin, outside click and Escape, and must keep official-documentation links operable.
- User-supplied reference images are previewed directly in the browser with no-referrer and are never fetched or proxied by the application server.
- Secrets are encrypted before persistence and are never serialized back to the browser.
- A private/local AI endpoint is allowed only when it exactly matches the operator-controlled `SITE_AI_ENDPOINT`; user-created provider endpoints remain subject to the public HTTPS allowlist and private-network SSRF rejection.
- The authenticated service-center API exposes only configured state, provider/model names, masked endpoints, timeout/language metadata, and whether a key exists. It never returns environment-variable secrets or raw provider responses.
- Every supported personal AI, translation, and text-push provider has client-bundled setup guidance covering activation, model/endpoint/key fields, testing order, and official documentation. Help content never contains or fetches user secrets.
- Shared-service connection tests are user-rate-limited, server-executed, endpoint-validated, response-size-bounded, and return only a success message plus elapsed time.
- History and favorite deletion supports both one-record and bounded batch requests. Every delete predicate combines validated record ids with the authenticated user id; deleting a favorite also removes its immutable revisions through the existing database cascade.
- Midjourney submissions use the current user's single active configuration, validate the destination against the SSRF policy, and persist success or failure independently from the 100-item Prompt history.
- Deleting a Midjourney provider configuration preserves its prior submission audit records while clearing the configuration reference.
- All schema changes are represented by generated Drizzle migrations.
- The graphite visual theme is expressed through shared semantic surface, border and text variables; colored block/parameter accents and purple primary actions remain presentation-only.
- The public repository ships mirrored Chinese and English quick-start, configuration, usage, deployment and troubleshooting guides. `.env.example` contains placeholders only, while `.env`, backups, generated output and local runtime data remain excluded from Git.
