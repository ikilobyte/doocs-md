# Stdio Markdown Render Design

## Goal

Add a new standalone module that renders a Markdown file to the final HTML fragment used for pasting into the WeChat Official Account editor, while reusing the existing rendering and styling logic.

## Constraints

- The new capability must live in a separate module.
- Rendering must reuse the existing `@md/core` renderer and theme pipeline.
- Style input must come from a JSON file passed by `--style`.
- Unsupported or unrelated web UI state must not become part of the CLI contract.
- The module should be split so future WeChat upload automation can reuse the render service.

## Chosen Approach

Create a new package `packages/render-stdio` with four parts:

1. `cli`
   Parses `--file` and `--style`, reads files, writes HTML to `stdout`, writes errors to `stderr`.
2. `config`
   Loads style JSON, validates only rendering-related fields, merges with existing defaults.
3. `render-service`
   Reuses `@md/core` renderer output and theme CSS generation, then runs the same WeChat-oriented HTML post-processing path used by the web app copy flow.
4. `wechat-html`
   Converts rendered HTML plus generated CSS into the final inline-styled HTML fragment for WeChat.

## Data Flow

1. Read Markdown from `--file`.
2. Load optional style JSON from `--style`.
3. Normalize config against existing defaults.
4. Render Markdown with `initRenderer`, `renderMarkdown`, and `postProcessHtml`.
5. Build theme CSS from the existing theme system.
6. Fetch the configured highlight.js CSS.
7. Inline and post-process HTML into the final WeChat fragment.
8. Print the fragment to `stdout`.

## Supported Style Fields

- `theme`
- `fontFamily`
- `fontSize`
- `primaryColor`
- `codeBlockTheme`
- `legend`
- `isMacCodeBlock`
- `isShowLineNumber`
- `isCiteStatus`
- `isUseIndent`
- `isUseJustify`
- `headingStyles`
- `cssContentConfig`

Unknown fields are ignored. Missing fields fall back to existing defaults.

## Required Adaptations

- Expose a reusable theme CSS builder from `@md/core`.
- Keep the new package isolated from the existing `md-cli` server package.
- Update web config export/import to include `headingStyles`, so style files can round-trip cleanly.

## Verification

- Run the new CLI against a sample Markdown file.
- Verify HTML is produced on `stdout` with no extra logs.
- Verify style overrides change the final HTML output.
- Run type/lint checks on touched files where feasible.
