# wechat-draft-cli

独立的 Go CLI 工具，用于读取渲染后的 HTML 文件并上传到微信公众号草稿箱。

## 用法

在项目目录下执行：

```bash
go run . --filepath /path/to/rendered.html
```

指定配置文件：

```bash
go run . --filepath /path/to/rendered.html --config ./config.yaml
```

## 配置

默认读取当前工作目录下的 `config.yaml`。

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

## 行为

- 标题从第一个 `h1` 提取，没有则回退到 `h2`、`h3`
- 第一张图片作为封面图来源
- 所有正文图片会上传到微信并替换为微信返回的 URL
- 封面图会上传为永久图片素材并生成 `thumb_media_id`
- `access_token` 使用 SDK，并通过本地文件缓存跨进程复用
