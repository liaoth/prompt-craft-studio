# Execution Board

| Workstream | Owner | Status | Verification |
| --- | --- | --- | --- |
| Prompt v2 schema, bilingual blocks and three AI variants | Root | Completed | Vitest, typecheck |
| Ten templates and parameter registry | Root | Completed | Registry/template tests |
| Site AI fallback and provider validation | Root | Completed | Unit tests, production build |
| Folders, favorites, immutable revisions and exports | Root | Completed | API validation tests, database migration |
| Responsive workbench and accessible drag/drop | Root | Completed | Desktop/mobile browser regression |
| Prompt v3 references, image command assistant and V1/V2 compatibility | Root | Completed | Vitest, typecheck, browser regression |
| Readability, control help and bundled Chinese phrase library | Root | Completed | Lint, visual/drag regression |
| Section 12.1–12.11 phrase import and progressive rendering | Root | Completed | 592 source rows, 642 normalized entries, search regression |
| Layout hierarchy, colored headings and pointer drag overlay | Root | Completed | Desktop and 390px browser regression |
| Interactive parameter-help portal | Root | Completed | Hover/focus, pin, link, outside/Escape regression |
| Shared Ollama / LibreTranslate service center | Root | Completed | Masked status API, live connection tests, desktop/mobile browser regression |
| Merged Prompt composer and bilingual color-token editing | Root | Completed | 41 tests, typecheck, lint, build, Docker and browser interaction regression |
| History/library deletion and provider setup guidance | Root | Completed | 43 tests, scoped batch APIs, desktop/mobile browser regression |
| Parameter tokens, ratio controls and graphite theme | Root | Completed | 45 tests, typecheck, lint, production build, Docker/browser regression |
| Contextual parameter disabling and filtering | Root | Completed | 46 tests, V7→V8.1 Quality regression, Docker/browser verification |
| Bilingual public documentation and reproducible GitHub release | Root | Completed | 16 Markdown files, link check, Compose validation, security scan, full release gate |
| Release integration | Root | Completed | Test/build/migration/Docker/browser gate |

## Release gate

- A non-empty Chinese idea always reaches the final Prompt.
- AI mode returns exactly concise, detailed and experimental variants; malformed JSON is repaired once.
- Prompt parameters are normalized at the end, duplicate aliases use the last explicit value, and invalid combinations are rejected server-side.
- Model, surface and task changes remove parameters that are no longer supported; disabled controls cannot reintroduce them into the live Prompt.
- V8.2 is the default; V8.0 can only be restored from an old snapshot and reports a replacement suggestion.
- Old v1/v2/v3 history, favorites and revisions load as schema v4; migrated favorites retain revision 1.
- Every private query and write is scoped by the authenticated user.
- History remains deduplicated and capped at 100 generation groups; favorites and revisions have no count cap.
- Folder deletion preserves works by moving them to unfiled.
- Provider secrets and private endpoints are encrypted at rest and masked in responses.
- Authentication IP limiting accepts forwarded client addresses only when exact trusted proxy IPs/CIDRs are configured.
- Guest page load does not call private APIs or emit expected 401 console noise.
- Production migration, test, typecheck, lint, build, Docker health check and browser regression all pass.

## Release evidence

- PostgreSQL backup: `backups/pre-v2-20260725.dump`.
- `npm test`: 3 test files, 38 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run db:generate`: 13 tables, no additional schema change.
- `npm audit --audit-level=high`: 0 vulnerabilities after upgrading React/RSC to 19.2.8 and applying the bounded brace-expansion 5.0.8 compatibility adapter.
- `npm run build`: standalone production output generated successfully.
- Fresh temporary PostgreSQL database: all migrations applied successfully and produced 13 public tables; the temporary database was removed afterward.
- Docker runtime and migrator images: rebuilt successfully from the pinned Node 22 Alpine digest.
- Local Compose application: `http://localhost:3000/api/health` returned `status=ok`, `database=connected`; container health is `healthy`.
- Section-12 import regression: all 11 source sections matched the required per-section counts (592 rows total), normalized Section-12 data contained 576 unique entries, and the merged default library contained exactly 642 unique entries.
- Browser regression: desktop and 390 × 844 mobile layout passed with no horizontal overflow; the creation pane remained full width, block counts stayed horizontal, common phrases rendered before templates, and live Prompt rendered before the block editor.
- Bilingual token regression: Chinese edits translated only the matching English block, manual English survived later Chinese changes until explicit resync, Chinese/English additions translated in the correct direction, keyboard deletion removed both language tokens and the shared structured block, and AI variant edits survived round trips.
- Interaction regression: default/personal phrase and existing-block drags exposed a fixed `z-index: 999` overlay, phrase sources remained in place, colored block/parameter headings computed at weight 750, and the fixed help portal exposed an operable official-documentation link.
- Guest production load emitted 0 console warnings/errors and made no private API request.
- Authenticated service-center regression: Ollama and LibreTranslate metadata remained masked; live tests returned success in 5.1 seconds and 870 ms respectively; personal DeepSeek override state was displayed; desktop and 390px layouts had no horizontal overflow or console errors.
- Local model tuning: `qwen2.5:3b` passed the full three-variant schema in 36 seconds cold and 8.5 seconds warm, replacing `qwen3:8b` (about 77 seconds); container JSON health returned in 547 ms.
- Official documentation regression: parameter placement, Omni V7/weight/conflicts, video-only parameters and Blend 2–5 image semantics were checked against the current Midjourney documentation.
- Authenticated regression: registration, email verification, login, generation, phrase refresh, favorite revision, folder creation, title/folder edit, selected export and download passed.
- Record-management regression: the history and favorites APIs expose user-scoped single and bounded batch deletion; the library selection toolbar enabled batch deletion only after selection and warned that favorite revisions are deleted with their work.
- Provider-help regression: all 15 AI/translation/push provider choices expose activation steps, endpoint/model/key guidance and official links; saved DeepSeek help, dynamic Ollama placeholders, and 390px single-column layout passed with zero console warnings/errors.
- Latest release gate: `npm test` passed 43 tests; typecheck, lint, production build, Docker rebuild, health check and authenticated desktop/mobile browser regression passed.
- Parameter-token regression: legacy and current `--no` values reconcile into variant-local negative blocks, positive English bodies no longer contain `exclude:`, and serialization emits exactly one trailing `--no`.
- Parameter-control regression: aspect ratios retain the string API contract through two positive-integer inputs; numeric `0`, registry steps, discrete numeric options and boundary states are preserved by the custom stepper.
- Variant-isolation regression: V4 restoration keeps each AI variant's negative blocks local and does not copy the selected variant's `--no` values into sibling variants.
- Latest code gate: `npm test` passed 45 tests; typecheck, lint and production build passed with no new runtime dependency or SQL migration.
- Latest deployment regression: the Docker image rebuilt successfully, migrations completed, `/api/health` returned `status=ok` and `database=connected`, and the app container reported healthy.
- Latest browser regression: 1280px desktop and 390px mobile had no horizontal overflow; graphite surfaces computed as `#1e1e1e/#202020/#242424`, ratio partial input removed stale `--ar`, `0` serialized correctly, step buttons worked, Profile/negative tokens updated the Prompt, and the console had no warning or error.
- Compatibility regression: Quality is enabled with V7 options 1/2/4, then becomes 48%-opacity disabled when switching to V8.1; its value is cleared, no `--quality` is serialized, no stale validation toast remains, and unsupported Turbo is removed from V8.1/V8.2 options.
- Latest compatibility gate: `npm test` passed 46 tests; typecheck, lint, production build, Docker health and browser console checks passed.
- Public-release documentation: Chinese and English README, quick start, configuration, user guide, deployment and troubleshooting documents cover Docker, PostgreSQL, SMTP, all provider layers, Ollama, LibreTranslate, endpoint security, text-forwarding semantics, backup and update workflows.
- Reproducibility gate: all 16 Markdown files passed local-link validation; both base and LibreTranslate Compose configurations parsed; `db:generate` reported 13 tables and no schema drift.
- Public-release security gate: ignored `.env` and `backups/` were excluded, known server credentials/webhook patterns and generic credential-shaped values were absent, official npm audit reported 0 vulnerabilities, and the rebuilt app returned `status=ok` with a healthy container.
