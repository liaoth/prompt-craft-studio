# User guide

[Home](../../README_EN.md) · [Quick start](quick-start.md) · [Configuration](configuration.md)

## Workspace layout

- **Left**: built-in phrases, personal phrases, search and filters, and scenario templates.
- **Center**: generation mode, Chinese idea, bilingual color-coded tokens, full prompt, structured editing, and image helpers.
- **Right**: Midjourney parameters.
- **Header/drawers**: history, work library, service configuration, and account.

Mobile uses pages and drawers while preserving the same features.

## Generation modes

### Rule mode

No AI key is required. The app uses deterministic structure, bilingual presets, and current parameters. It is useful for fast drafting and offline-friendly operation.

A non-empty Chinese idea is never discarded: it becomes a subject when no subject exists, otherwise it becomes a custom block.

### Three AI variants

This requires a per-user or shared site AI. One successful generation returns:

- **Concise**: fewer words and a clear focus.
- **Detailed**: richer detail, camera, and atmosphere; selected by default.
- **Experimental**: bolder visual relationships and style combinations.

The Concise / Detailed / Experimental selector appears only after multi-variant generation succeeds. Each variant preserves its own edits.

## Bilingual color-coded tokens

The Chinese and English representation of a concept share one token ID:

- Select with a click.
- Edit with a double click or Enter.
- Delete the complete bilingual token with Delete/Backspace while selected.
- Delete/Backspace edits characters while the token is in edit mode.
- Enter saves and Escape cancels.
- Type at the end and press Enter or comma to create a custom block.

Changing a Chinese block debounces and translates only that block. Editing English directly protects that block from later Chinese updates until **Retranslate from Chinese** is selected.

Copy, favorite, export, and text forwarding always rebuild from the current blocks.

## Structured blocks and phrases

Each block belongs to subject, action, environment, composition, camera, lighting, color, material, medium, style, mood, negative, or custom.

- Use the drag handle to sort within a group or move across groups.
- Drag a built-in or personal phrase into any group. This copies the phrase and never removes the library item.
- Clicking a phrase uses its default group.
- Built-in phrases are read-only; personal phrases can be created, edited, sorted, and deleted.
- A lower **Sort order** number appears first; the minimum is 0.

## Scenario templates

The ten templates cover portrait photography, product advertising, e-commerce hero images, anime characters, cinematic storyboards, architecture, game concept art, logos/icons, social covers, and seamless textures.

When applying a template:

- **Merge** keeps existing blocks and adds template content.
- **Replace** replaces the current structure.

Use merge when the draft already contains important details.

## Parameter panel

Select these contexts first:

1. Surface: Midjourney Web or Discord.
2. Task: image or video.
3. Model version.

The panel recalculates compatibility from all three:

- Unsupported parameters are disabled.
- Existing values that become incompatible are excluded from the full prompt.
- Help popovers explain purpose, range, default, model notes, conflicts, examples, and official docs.
- Numeric fields accept minus/plus stepping and direct input.
- Aspect ratio uses separate width and height inputs.
- Negative tokens are shared with the structured Negative group and serialize to exactly one `--no`.
- Profile / Moodboard uses editable code tokens.

The full prompt is always ordered as image URLs, English body, and a normalized parameter suffix. Parameters only appear at the end.

## Image references and command helpers

Only HTTPS image URLs are accepted. The app does not upload local files or fetch images from the server.

- **Image prompts** appear before the text body.
- **Style Reference** accepts image URLs, numeric codes, or `random`.
- **Omni Reference** serializes only for supported models.
- **Video start/end frames** are used for video tasks.

Helpers:

- **Imagine** creates a Web prompt and Discord `/imagine prompt:` text.
- **Describe** copies `/describe`; the attachment must be uploaded manually in Midjourney.
- **Blend** validates 2–5 images; Discord still requires file uploads.
- **Video** requires a start frame and limits parameters to video-compatible choices.

These helpers prepare text and instructions. They do not connect to an official Midjourney job API.

## Copy and export

- **Copy full prompt** includes references and parameters.
- **Copy English body** excludes parameters.
- **Copy Chinese description** is convenient for documentation.
- **TXT / Markdown / JSON** exports the current prompt, a work, selected works, or a complete folder.

JSON preserves blocks, parameters, references, and snapshot schema version for re-import or programmatic use.

## History and work library

### History

- Saved automatically after successful generation.
- Identical content is deduplicated by hash and receives a fresh timestamp.
- Only the latest 100 items per user are retained.
- Single and batch deletion are supported.

### Work library

- Favorites are unlimited.
- Works have titles, notes, and optional folders.
- Deleting a folder moves its works to Unfiled; it does not delete them.
- Saving changed prompt content creates an immutable revision. Changing title, note, or folder does not.
- Older revisions can be viewed, restored to the editor, or saved as a new revision.
- Single and batch deletion are supported.

Deleting or expiring history never affects a saved work.

## Service configuration

Each provider has setup steps, field descriptions, examples, and official links. Recommended workflow:

1. Create a configuration.
2. Save it.
3. Test connectivity.
4. Enable it.
5. Return to generation and make one real request.

A user's active configuration takes precedence over the site fallback. See [Configuration](configuration.md) for complete examples.

## Text forwarding

**Send to configured endpoint** forwards the selected variant's complete prompt to the active Discord webhook or custom HTTP endpoint and records delivery status.

A Discord webhook posts a normal message. It **does not trigger Midjourney rendering even if the message contains `/imagine`**.
