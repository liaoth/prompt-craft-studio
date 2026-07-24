# Execution Board

| Workstream | Owner | Status | Verification |
| --- | --- | --- | --- |
| Site bootstrap and deployable packaging | Root | Completed | Production build, Docker configuration |
| Prompt, AI, and translation domain | Prompt engine | Completed | Vitest |
| Authentication, database, and APIs | Backend | Completed | Vitest, typecheck |
| Responsive workbench UI | UI | Completed | Typecheck, production build |
| Integration and release | Root | Completed | 17 tests, lint, typecheck, migration check, audit, build |
| Midjourney direct submission v2 | Root | Completed | 21 tests, lint, typecheck, migration generated, audit, production build |

## Release gate

- No plaintext provider or translation keys in database responses, logs, fixtures, or committed files.
- Every durable record is scoped by authenticated user id.
- Prompt history is deduplicated and pruned to 100 records per user.
- Favorites and phrase snippets have no per-user count cap.
- External requests have endpoint validation, request limits, and timeouts.
- Discord webhook payloads contain only the Prompt content; lookalike hosts and unsafe custom endpoints are rejected.
- Midjourney submissions remain available when their provider configuration is deleted.
- Production build and automated tests pass.

## Verified release evidence

- `npm test`: 17/17 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run db:generate`: 9 tables, no uncommitted schema change.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm run build`: standalone production output generated in `dist/standalone`.
- Docker Desktop 4.83.0 is installed. The Windows Virtual Machine Platform and WSL features were enabled, and a system restart is required before the Linux container engine can start.

## Version 2 release evidence

- `npm test`: 21/21 passed, including Discord URL lookalike rejection and webhook/custom HTTP adapter behavior.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run db:generate`: generated `0001_strong_captain_marvel.sql` for 11 tables.
- `npm audit --audit-level=high --registry=https://registry.npmjs.org`: 0 vulnerabilities.
- `npm run build`: standalone production output generated in `dist/standalone`.
- Actual database migration and Compose startup are pending the required Windows restart.
