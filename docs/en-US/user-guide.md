# User guide

The application opens directly into the Local Workspace; no sign-in is required.

## Compose prompts

1. Select a template or fill subject, action, environment, composition, camera, lighting, color, material, medium, style, mood, and negative content.
2. Configure aspect ratio, version, stylization, and other Midjourney parameters.
3. Use rule-based generation or enable an AI service.
4. Copy or export the Chinese and English result.

## Local records

- History is deduplicated by content and keeps the latest 100 records.
- Favorites support titles, folders, edits, and immutable revisions.
- Personal phrases can be assigned and ordered by prompt field.
- Service settings and encrypted credentials stay in local SQLite.

## Service configuration

Open Service Configuration and add AI, translation, and text-push providers. Test a provider before enabling it. Only one provider of each kind is active. Site-shared services have been removed.

## Updates

Close the app and back up `prompt-craft.db` with `local.key` before updating. Forward migrations run automatically on the next launch. Never open one data directory with two app versions at the same time.

## Privacy

Local editing and rule-based generation do not initiate network requests. Content is sent to a third party only when you use a configured AI, translation, or push service; that provider's privacy policy applies.
