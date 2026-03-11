# WeChat Draft Upload Design

## Goal

Add a dedicated draft-upload module for `packages/render-stdio` so rendered HTML can be uploaded to the WeChat Official Account draft box without mixing upload behavior into the render service.

## Scope

- Add a standalone `upload-draft` command that reads rendered HTML from `filepath`.
- Keep `render-service` responsible only for Markdown-to-HTML rendering.
- Reuse the existing WeChat media and draft API integration where practical.
- Add local `access_token` caching for `appid + secret` authentication.
- Preserve the current `--draft` flow as a compatibility layer while moving upload logic behind a dedicated service boundary.

## Non-Goals

- No new editor UI.
- No support for draft update, publish, or material management beyond the cover/body images needed for draft creation.
- No repository-local token cache file.

## Chosen Approach

Use the existing `packages/render-stdio` package and split responsibilities into two paths:

1. `render`
   Reads Markdown, loads style config, and returns the final WeChat HTML fragment.
2. `upload-draft`
   Reads a rendered HTML file, extracts article metadata, migrates images, resolves `access_token`, and creates the WeChat draft.

The existing legacy invocation remains supported:

- `md-stdio --file ... --draft ...`

Internally, the legacy flow will render first and then call the same upload service used by `upload-draft`.

## Module Boundaries

- `src/render-service.js`
  Keeps pure render behavior only.
- `src/wechat/upload-draft-service.js`
  Orchestrates HTML file reading, title extraction, image migration, token resolution, and draft creation.
- `src/wechat/title.js`
  Extracts the article title from rendered HTML using the first available `h1`, then `h2`, then `h3`.
- `src/wechat/media.js`
  Reuses the current image migration behavior:
  - first image becomes the cover upload source
  - all body images are uploaded through WeChat and rewritten in HTML
- `src/wechat/auth.js`
  Resolves tokens from direct input or `appid + secret`.
- `src/wechat/token-cache.js`
  Stores and refreshes cached `access_token` values.

## CLI Contract

Preferred commands:

```bash
md-stdio render --file /path/to/article.md [--style /path/to/style.json] [--copy]
md-stdio upload-draft --filepath /path/to/rendered.html --appid YOUR_APPID --secret YOUR_SECRET
md-stdio upload-draft --filepath /path/to/rendered.html --access-token YOUR_ACCESS_TOKEN
```

Validation rules:

- `render` requires `--file`
- `upload-draft` requires `--filepath`
- `upload-draft` requires either `--access-token` or `--appid --secret`
- `--appid` and `--secret` must be provided together
- `--copy` is only valid for `render`
- legacy `--draft` stays available, but routes through the new upload service

## Draft Data Rules

- `title`
  Extract from the first `h1`. If no `h1` exists, fall back to the first `h2`, then `h3`. Fail if none exist.
- `thumb_media_id`
  Upload the first content image as permanent material and use its `media_id`.
- `content`
  Use the rendered HTML after rewriting all `<img src>` values to WeChat-hosted URLs returned by `uploadimg`.
- `need_open_comment`
  Send `0`.
- `only_fans_can_comment`
  Send `0`.
- `author`, `digest`, `content_source_url`
  Omit for now.

## Access Token Cache

Cache is local to the user environment and keyed by `appid`.

Suggested cache locations:

- macOS: `~/Library/Caches/md-codex/wechat-access-token.json`
- Linux: `${XDG_CACHE_HOME:-~/.cache}/md-codex/wechat-access-token.json`
- Windows: `%LOCALAPPDATA%/md-codex/wechat-access-token.json`

Cache record shape:

```json
{
  "APPID": {
    "accessToken": "token",
    "expiresAt": 1760000000000,
    "updatedAt": 1759990000000,
    "source": "stable_token"
  }
}
```

Refresh behavior:

- If `--access-token` is provided, do not read or write cache.
- If cached token expires in more than 10 minutes, reuse it.
- If expired or within 10 minutes of expiry, request a new token and replace the cache entry.
- If the draft chain fails because the token is invalid, force refresh once and retry the upload flow once.

Fault tolerance:

- Missing cache file is fine.
- Invalid cache JSON is ignored and rebuilt.
- Cache writes use a temp file followed by rename.

## Error Handling

- Missing or unreadable `filepath` fails fast.
- Empty HTML input fails fast.
- Missing `h1/h2/h3` fails because draft creation needs a title.
- Missing image fails because draft creation needs a cover image.
- Body images that violate WeChat size or format limits fail with the offending source path or URL.
- Any API failure exits non-zero and prints a concise error message.

## Output Contract

`upload-draft` writes JSON to `stdout` with:

- `mode`
- `title`
- `image_count`
- `thumb_media_id`
- `media_id`
- `token_source`
- `response`

`token_source` values:

- `provided`
- `cache`
- `stable_token`
- `token`

## Verification

- `pnpm lint`
- `pnpm type-check`
- CLI argument smoke checks for both `render` and `upload-draft`
- Local smoke test:
  - render sample Markdown to HTML file
  - run `upload-draft --filepath ...`
  - verify title extraction and non-network behavior
- One real API upload test using a supplied `access_token`
