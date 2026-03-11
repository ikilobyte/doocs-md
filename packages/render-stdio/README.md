# @md/render-stdio

Render Markdown into the final WeChat HTML fragment, or upload rendered HTML into the WeChat Official Account draft box.

## Commands

### Render

```bash
pnpm --filter @md/render-stdio render -- render --file /path/to/article.md
pnpm --filter @md/render-stdio render -- render --file /path/to/article.md --style /path/to/style.json
pnpm --filter @md/render-stdio render -- render --file /path/to/article.md --style /path/to/style.json --copy
```

`render` writes the final HTML fragment to `stdout`.

Pass `--copy` to also copy the final HTML fragment to the macOS clipboard as `text/html` while still writing the same content to `stdout`.

### Upload Draft

```bash
pnpm --filter @md/render-stdio render -- upload-draft --filepath /path/to/rendered.html --access-token YOUR_ACCESS_TOKEN
pnpm --filter @md/render-stdio render -- upload-draft --filepath /path/to/rendered.html --appid YOUR_APPID --secret YOUR_SECRET
```

`upload-draft` reads a rendered HTML file and uploads it to the WeChat Official Account draft box.

Rules:

- requires either `--access-token` or `--appid --secret`
- rewrites body images through WeChat `uploadimg`
- uses the first content image as the cover source and uploads it again to get `thumb_media_id`
- extracts the draft title from the first `h1`, then `h2`, then `h3`
- requires at least one image in the article

When using `--appid --secret`, `access_token` is cached locally and refreshed when it is close to expiry.

### Legacy Compatibility

The old invocation style is still available:

```bash
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --style /path/to/style.json
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --copy
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --draft --access-token YOUR_ACCESS_TOKEN
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --draft --appid YOUR_APPID --secret YOUR_SECRET
```

In legacy `--draft` mode, the command renders Markdown first and then calls the same upload service used by `upload-draft`.

## Style Config

See [STYLE_CONFIG.md](./STYLE_CONFIG.md) for the supported JSON fields, defaults, and examples.
