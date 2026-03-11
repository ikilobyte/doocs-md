# Go WeChat Draft CLI Design

## Goal

Add a standalone Go CLI project that reads rendered HTML from a local file, derives the metadata required by the WeChat Official Account draft API, and uploads the content through `github.com/silenceper/wechat/v2`.

## Scope

- Create a new Go project under `packages/`.
- Read HTML input from `--filepath`.
- Read WeChat credentials and draft defaults from `config.yaml`.
- Parse title and images from the rendered HTML.
- Upload content images and cover image to WeChat.
- Create a draft in the WeChat Official Account draft box.
- Cache `access_token` locally through a file-backed cache implementation that satisfies the SDK cache interface.

## Non-Goals

- No integration with the existing Node CLI.
- No publish, update-draft, or material listing commands.
- No UI changes.
- No Markdown rendering in the Go project. Input is already rendered HTML.

## Chosen Approach

Create a new standalone CLI package:

- `packages/wechat-draft-cli`

The project uses:

- `github.com/silenceper/wechat/v2`
- `officialaccount.GetMaterial()` for image uploads
- `officialaccount.GetDraft()` for draft creation

Because the SDK's built-in memory cache is process-local and not useful for a short-lived CLI, the project provides its own file-backed implementation of `cache.Cache`. That allows the SDK to manage token refresh while the CLI still reuses cached tokens across runs.

## CLI Contract

Primary usage:

```bash
go run . --filepath /path/to/rendered.html
```

Optional config path override:

```bash
go run . --filepath /path/to/rendered.html --config ./config.yaml
```

Rules:

- `--filepath` is required
- `--config` defaults to `./config.yaml` in the project root
- success writes JSON to `stdout`
- failure writes a concise message to `stderr` and exits non-zero

## Project Structure

- `main.go`
  CLI entrypoint
- `internal/config`
  YAML parsing and validation
- `internal/htmlmeta`
  Title extraction and image discovery from HTML
- `internal/assets`
  Read local images, download remote images, decode base64 data URLs, manage temp files
- `internal/wechat`
  SDK wiring, image upload, HTML rewriting, and draft creation
- `internal/cache`
  File-backed cache implementing `github.com/silenceper/wechat/v2/cache.Cache`
- `config.example.yaml`
  Example configuration
- `README.md`
  Usage and config docs

## Config Contract

`config.yaml`:

```yaml
wechat:
  app_id: your-appid
  app_secret: your-app-secret
  use_stable_ak: true

cache:
  access_token_file: .cache/wechat/access_token.json

draft:
  show_cover_pic: 0
  need_open_comment: 0
  only_fans_can_comment: 0
```

Field meanings:

- `wechat.app_id`
  Official account appid
- `wechat.app_secret`
  Official account secret
- `wechat.use_stable_ak`
  Whether the SDK should prefer stable access token retrieval
- `cache.access_token_file`
  Local token cache file path
- `draft.show_cover_pic`
  WeChat draft `show_cover_pic`
- `draft.need_open_comment`
  WeChat draft `need_open_comment`
- `draft.only_fans_can_comment`
  WeChat draft `only_fans_can_comment`

## HTML Parsing Rules

Input:

- rendered HTML file path from `--filepath`

Processing:

1. Read HTML file content
2. Extract title from the first available `h1`, otherwise `h2`, otherwise `h3`
3. Collect all `img[src]`
4. Use the first image as the cover source
5. Upload all images and rewrite the HTML with WeChat-hosted URLs
6. Upload the cover source as permanent image material to get `thumb_media_id`
7. Create the draft with derived title, rewritten HTML, cover media id, and defaults from config

Supported image sources:

- `http://...`
- `https://...`
- `//...`
- absolute local paths
- relative local paths resolved relative to the HTML file
- `data:image/...;base64,...`

## Upload Behavior

- Body images use the SDK material image upload entry for `uploadimg`
- Cover image uses permanent material upload and returns `thumb_media_id`
- The rewritten HTML is sent to `draft.AddDraft`
- One article is created per invocation

## Access Token Cache

The CLI implements a file-backed cache adapter that satisfies the SDK cache interface.

Cache behavior:

- cache file path comes from `config.yaml`
- missing cache file is allowed
- invalid cache contents are ignored and replaced
- writes use temp file + rename
- expiration respects the timeout requested by the SDK

This keeps token lifecycle inside the SDK while preserving cross-process reuse.

## Error Handling

Fail fast when:

- `--filepath` is missing
- `config.yaml` is missing or invalid
- HTML content is empty
- no `h1/h2/h3` is found
- no image is found
- any image cannot be read or downloaded
- WeChat image upload or draft creation fails

Errors should include the failing file path or image source when possible.

## Output Contract

Success output:

```json
{
  "mode": "draft",
  "title": "Article Title",
  "image_count": 3,
  "thumb_media_id": "xxx",
  "media_id": "xxx"
}
```

## Verification

- `go test ./...`
- `go run . --filepath /path/to/rendered.html`
- one real upload using a valid `config.yaml`
