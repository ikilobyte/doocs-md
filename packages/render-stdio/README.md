# @md/render-stdio

Render a Markdown file to the final HTML fragment used for pasting into the WeChat Official Account editor.

## Usage

```bash
pnpm --filter @md/render-stdio render -- --file /path/to/article.md
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --style /path/to/style.json
```

The command writes the rendered HTML fragment to `stdout`.
