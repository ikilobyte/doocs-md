# @md/render-stdio

Render a Markdown file to the final HTML fragment used for pasting into the WeChat Official Account editor.

## Usage

```bash
pnpm --filter @md/render-stdio render -- --file /path/to/article.md
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --style /path/to/style.json
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --style /path/to/style.json --copy
```

The command writes the rendered HTML fragment to `stdout`.

Pass `--copy` to also copy the final HTML fragment to the macOS clipboard as HTML while still writing the same content to `stdout`.

## Style Config

See [STYLE_CONFIG.md](./STYLE_CONFIG.md) for the supported JSON fields, defaults, and examples.
