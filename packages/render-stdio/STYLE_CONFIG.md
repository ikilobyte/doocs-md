# `--style` 配置文件说明

`@md/render-stdio` 支持通过 `--style /path/to/style.json` 传入样式配置。

该配置不会引入新的渲染规则，只会复用当前网页端已有的样式配置能力，并按现有渲染逻辑生效。

## 命令行用法

```bash
pnpm --filter @md/render-stdio render -- --file /path/to/article.md
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --style /path/to/style.json
pnpm --filter @md/render-stdio render -- --file /path/to/article.md --style /path/to/style.json --copy
```

也支持等号写法：

```bash
node /Users/sunny/Documents/project/ai/md-codex/packages/render-stdio/index.js --file=/path/to/article.md --style=/path/to/style.json --copy
```

`--copy` 为可选参数。传入后，CLI 会在保留 `stdout` 输出的同时，把同一份最终 HTML 片段复制到 macOS 系统剪贴板，剪贴板中会写入 HTML 类型内容。

## 配置规则

- 配置文件必须是 UTF-8 编码的 JSON 对象。
- 所有字段都可选；未传入的字段使用渲染核心默认值。
- 可以直接使用网页端导出的配置 JSON；CLI 只会读取渲染相关字段，其他字段会忽略。
- 校验使用的是现有配置项的内部 `value`，不是界面上的中文 `label`。

## 支持字段

### `theme`

- 作用：主题
- 类型：字符串
- 可选值：`default`、`grace`、`simple`
- 默认值：`default`

### `fontFamily`

- 作用：正文字体
- 类型：字符串
- 可选值：

```json
[
  "-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB , Microsoft YaHei UI , Microsoft YaHei ,Arial,sans-serif",
  "Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif",
  "Menlo, Monaco, 'Courier New', monospace"
]
```

- 默认值：

```json
"-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB , Microsoft YaHei UI , Microsoft YaHei ,Arial,sans-serif"
```

### `fontSize`

- 作用：正文字号
- 类型：字符串
- 可选值：`14px`、`15px`、`16px`、`17px`、`18px`
- 默认值：`16px`

### `primaryColor`

- 作用：主题色
- 类型：非空字符串
- 默认值：`#0F4C81`
- 建议：使用十六进制颜色值，例如 `#FA5151`

### `codeBlockTheme`

- 作用：代码块高亮主题
- 类型：字符串
- 默认值：

```json
"https://cdn-doocs.oss-cn-shenzhen.aliyuncs.com/npm/highlightjs/11.11.1/styles/github-dark.min.css"
```

- 注意：当前实现使用的是完整 CSS URL，不是 `github-dark` 这种短名称。

完整可选值见 [packages/shared/src/configs/style.ts](/Users/sunny/Documents/project/ai/md-codex/packages/shared/src/configs/style.ts) 中的 `codeBlockThemeOptions`。

### `legend`

- 作用：图片图注格式
- 类型：字符串
- 可选值：`title-alt`、`alt-title`、`title`、`alt`、`none`
- 默认值：`alt`

### `isMacCodeBlock`

- 作用：是否启用 Mac 风格代码块
- 类型：布尔值
- 默认值：`true`

### `isShowLineNumber`

- 作用：是否显示代码块行号
- 类型：布尔值
- 默认值：`false`

### `isCiteStatus`

- 作用：是否将微信外链转为底部引用
- 类型：布尔值
- 默认值：`false`

### `isUseIndent`

- 作用：正文段落首行缩进
- 类型：布尔值
- 默认值：`false`

### `isUseJustify`

- 作用：正文两端对齐
- 类型：布尔值
- 默认值：`false`

### `headingStyles`

- 作用：分别指定 `h1` 到 `h6` 的标题样式
- 类型：对象
- 支持的 key：`h1`、`h2`、`h3`、`h4`、`h5`、`h6`
- 支持的 value：`default`、`color-only`、`border-bottom`、`border-left`、`custom`
- 默认值：`{}`

示例：

```json
{
  "headingStyles": {
    "h2": "border-left",
    "h3": "border-bottom",
    "h4": "color-only"
  }
}
```

各取值含义：

- `default`：沿用当前主题默认标题样式
- `color-only`：仅使用主题色文字
- `border-bottom`：添加下边框并使用主题色
- `border-left`：添加左边框并使用主题色
- `custom`：由自定义 CSS 接管；不会自动生成预设样式

### `cssContentConfig`

- 作用：复用网页端“自定义 CSS”配置
- 类型：对象
- 要求：
  - `active` 必须是非空字符串
  - `tabs` 必须是非空数组
  - 每个 tab 至少需要 `name` 和 `content`

结构示例：

```json
{
  "cssContentConfig": {
    "active": "方案1",
    "tabs": [
      {
        "title": "方案1",
        "name": "方案1",
        "content": "#output h6 { color: #0F4C81; font-style: italic; }"
      }
    ]
  }
}
```

说明：

- 实际只会读取 `active` 对应 tab 的 `content`
- 如果 `active` 没找到，会回退到第一个 tab
- 当 `headingStyles` 中某级标题使用 `custom` 时，应通过这里提供对应 CSS

## 最小示例

```json
{
  "theme": "grace",
  "fontSize": "18px",
  "primaryColor": "#FA5151"
}
```

## 完整示例

```json
{
  "theme": "grace",
  "fontFamily": "-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB , Microsoft YaHei UI , Microsoft YaHei ,Arial,sans-serif",
  "fontSize": "16px",
  "primaryColor": "#0F4C81",
  "codeBlockTheme": "https://cdn-doocs.oss-cn-shenzhen.aliyuncs.com/npm/highlightjs/11.11.1/styles/github-dark.min.css",
  "legend": "alt",
  "isMacCodeBlock": true,
  "isShowLineNumber": false,
  "isCiteStatus": true,
  "isUseIndent": false,
  "isUseJustify": true,
  "headingStyles": {
    "h1": "default",
    "h2": "border-left",
    "h3": "border-bottom",
    "h4": "color-only",
    "h5": "default",
    "h6": "custom"
  },
  "cssContentConfig": {
    "active": "方案1",
    "tabs": [
      {
        "title": "方案1",
        "name": "方案1",
        "content": "#output h6 { color: #0F4C81; font-style: italic; }"
      }
    ]
  }
}
```

## 常见问题

### 1. 可以直接用网页端导出的 JSON 吗？

可以。CLI 会忽略不相关字段，只读取渲染需要的配置项。

### 2. `codeBlockTheme` 可以写 `github-dark` 吗？

不可以。当前实现要求完整 CSS URL。

### 3. `headingStyles.h2 = "custom"` 但没写 `cssContentConfig` 会怎样？

不会报错，但不会自动生成该标题级别的自定义样式。

### 4. 哪些情况会直接报错？

常见情况包括：

- JSON 根节点不是对象
- `theme`、`fontSize`、`legend`、`headingStyles.*` 不在现有可选值内
- `isMacCodeBlock`、`isShowLineNumber`、`isCiteStatus`、`isUseIndent`、`isUseJustify` 不是布尔值
- `cssContentConfig.tabs` 为空
- `cssContentConfig.active` 为空

## 推荐使用方式

- 最稳妥的方式是在网页端调好样式后导出 JSON，再直接传给 `--style`
- 手写配置时，只写需要覆盖的字段，其余交给默认值
- 需要局部特殊样式时，优先通过 `cssContentConfig` 复用网页端同款自定义 CSS 能力
