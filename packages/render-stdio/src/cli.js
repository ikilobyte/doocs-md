import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { copyHtmlToClipboard } from './clipboard/index.js'
import { loadStyleConfig } from './config.js'
import { loadMdModules } from './core-loader.js'
import { renderToWechatHtml } from './render-service.js'
import { createWechatDraft, createWechatDraftFromFile } from './wechat/service.js'

const SUPPORTED_COMMANDS = new Set([`render`, `upload-draft`])

function usage(command = null) {
  if (command === `render`) {
    return [
      `Usage: md-stdio render --file /path/to/article.md [--style /path/to/style.json] [--output /path/to/output.html] [--copy]`,
      ``,
      `Options:`,
      `  --file   Markdown 文件路径`,
      `  --style  样式配置 JSON 路径`,
      `  --output 输出 HTML 文件路径；传入后不再写入 stdout`,
      `  --copy   复制最终 HTML 到 macOS 剪贴板 (text/html)`,
      `  --help   显示帮助`,
    ].join(`\n`)
  }

  if (command === `upload-draft`) {
    return [
      `Usage: md-stdio upload-draft --filepath /path/to/rendered.html (--access-token TOKEN | --appid APPID --secret SECRET)`,
      ``,
      `Options:`,
      `  --filepath      已渲染 HTML 文件路径`,
      `  --appid         微信公众号 appid`,
      `  --secret        微信公众号 secret`,
      `  --access-token  直接使用已有 access_token`,
      `  --help          显示帮助`,
    ].join(`\n`)
  }

  return [
    `Usage:`,
    `  md-stdio render --file /path/to/article.md [--style /path/to/style.json] [--output /path/to/output.html] [--copy]`,
    `  md-stdio upload-draft --filepath /path/to/rendered.html (--access-token TOKEN | --appid APPID --secret SECRET)`,
    ``,
    `Legacy usage remains supported:`,
    `  md-stdio --file /path/to/article.md [--style /path/to/style.json] [--output /path/to/output.html] [--copy]`,
    `  md-stdio --file /path/to/article.md --draft --appid APPID --secret SECRET`,
    `  md-stdio --file /path/to/article.md --draft --access-token TOKEN`,
  ].join(`\n`)
}

function readOptionValue(argv, index, option) {
  const current = argv[index]
  if (current.startsWith(`${option}=`)) {
    return current.slice(option.length + 1)
  }

  const nextValue = argv[index + 1]
  if (!nextValue || nextValue.startsWith(`--`)) {
    throw new Error(`${option} 需要一个值`)
  }

  return nextValue
}

function normalizeArgv(argv) {
  return argv[0] === `--` ? argv.slice(1) : argv
}

function parseAuthOptions(parsed, modeLabel) {
  const hasDirectToken = Boolean(parsed.accessToken)
  const hasCredentialPair = Boolean(parsed.appid && parsed.secret)
  const hasPartialCredential = Boolean(parsed.appid || parsed.secret)

  if (!hasDirectToken && !hasCredentialPair) {
    throw new Error(`${modeLabel} 需要传入 --access-token 或 --appid --secret`)
  }

  if (hasPartialCredential && !hasCredentialPair) {
    throw new Error(`--appid 和 --secret 必须同时传入`)
  }
}

function parseRenderArgs(argv) {
  const parsed = {
    command: `render`,
    copy: false,
    file: null,
    help: false,
    output: null,
    style: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === `--help`) {
      parsed.help = true
      continue
    }

    if (current === `--copy`) {
      parsed.copy = true
      continue
    }

    if (current === `--file` || current.startsWith(`--file=`)) {
      parsed.file = resolve(readOptionValue(argv, index, `--file`))
      if (current === `--file`) {
        index += 1
      }
      continue
    }

    if (current === `--style` || current.startsWith(`--style=`)) {
      parsed.style = resolve(readOptionValue(argv, index, `--style`))
      if (current === `--style`) {
        index += 1
      }
      continue
    }

    if (current === `--output` || current.startsWith(`--output=`)) {
      parsed.output = resolve(readOptionValue(argv, index, `--output`))
      if (current === `--output`) {
        index += 1
      }
      continue
    }

    throw new Error(`未知参数: ${current}`)
  }

  if (!parsed.help && !parsed.file) {
    throw new Error(`render 缺少 --file 参数`)
  }

  return parsed
}

function parseUploadDraftArgs(argv) {
  const parsed = {
    accessToken: null,
    appid: null,
    command: `upload-draft`,
    filepath: null,
    help: false,
    secret: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === `--help`) {
      parsed.help = true
      continue
    }

    if (current === `--filepath` || current.startsWith(`--filepath=`)) {
      parsed.filepath = resolve(readOptionValue(argv, index, `--filepath`))
      if (current === `--filepath`) {
        index += 1
      }
      continue
    }

    if (current === `--appid` || current.startsWith(`--appid=`)) {
      parsed.appid = readOptionValue(argv, index, `--appid`)
      if (current === `--appid`) {
        index += 1
      }
      continue
    }

    if (current === `--secret` || current.startsWith(`--secret=`)) {
      parsed.secret = readOptionValue(argv, index, `--secret`)
      if (current === `--secret`) {
        index += 1
      }
      continue
    }

    if (current === `--access-token` || current.startsWith(`--access-token=`)) {
      parsed.accessToken = readOptionValue(argv, index, `--access-token`)
      if (current === `--access-token`) {
        index += 1
      }
      continue
    }

    throw new Error(`未知参数: ${current}`)
  }

  if (!parsed.help && !parsed.filepath) {
    throw new Error(`upload-draft 缺少 --filepath 参数`)
  }

  if (!parsed.help) {
    parseAuthOptions(parsed, `upload-draft`)
  }

  return parsed
}

function parseLegacyArgs(argv) {
  const parsed = {
    accessToken: null,
    appid: null,
    command: `legacy`,
    copy: false,
    draft: false,
    file: null,
    help: false,
    output: null,
    secret: null,
    style: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === `--help`) {
      parsed.help = true
      continue
    }

    if (current === `--copy`) {
      parsed.copy = true
      continue
    }

    if (current === `--draft`) {
      parsed.draft = true
      continue
    }

    if (current === `--file` || current.startsWith(`--file=`)) {
      parsed.file = resolve(readOptionValue(argv, index, `--file`))
      if (current === `--file`) {
        index += 1
      }
      continue
    }

    if (current === `--style` || current.startsWith(`--style=`)) {
      parsed.style = resolve(readOptionValue(argv, index, `--style`))
      if (current === `--style`) {
        index += 1
      }
      continue
    }

    if (current === `--output` || current.startsWith(`--output=`)) {
      parsed.output = resolve(readOptionValue(argv, index, `--output`))
      if (current === `--output`) {
        index += 1
      }
      continue
    }

    if (current === `--appid` || current.startsWith(`--appid=`)) {
      parsed.appid = readOptionValue(argv, index, `--appid`)
      if (current === `--appid`) {
        index += 1
      }
      continue
    }

    if (current === `--secret` || current.startsWith(`--secret=`)) {
      parsed.secret = readOptionValue(argv, index, `--secret`)
      if (current === `--secret`) {
        index += 1
      }
      continue
    }

    if (current === `--access-token` || current.startsWith(`--access-token=`)) {
      parsed.accessToken = readOptionValue(argv, index, `--access-token`)
      if (current === `--access-token`) {
        index += 1
      }
      continue
    }

    throw new Error(`未知参数: ${current}`)
  }

  if (!parsed.help && !parsed.file) {
    throw new Error(`缺少 --file 参数`)
  }

  if (parsed.draft && parsed.copy) {
    throw new Error(`--draft 与 --copy 不能同时使用`)
  }

  if (parsed.draft && parsed.output) {
    throw new Error(`--draft 与 --output 不能同时使用`)
  }

  if (!parsed.help && parsed.draft) {
    parseAuthOptions(parsed, `--draft`)
  }

  return parsed
}

export function parseArgs(argv) {
  const normalizedArgv = normalizeArgv(argv)
  const command = normalizedArgv[0]

  if (SUPPORTED_COMMANDS.has(command)) {
    if (command === `render`) {
      return parseRenderArgs(normalizedArgv.slice(1))
    }

    if (command === `upload-draft`) {
      return parseUploadDraftArgs(normalizedArgv.slice(1))
    }
  }

  return parseLegacyArgs(normalizedArgv)
}

async function renderMarkdownFile(filePath, stylePath) {
  const markdown = await readFile(filePath, `utf8`)
  const mdModules = await loadMdModules()
  const styleConfig = await loadStyleConfig(stylePath, mdModules)
  return renderToWechatHtml(markdown, styleConfig, { contentFilePath: filePath })
}

export async function run(argv) {
  try {
    const args = parseArgs(argv)

    if (args.help) {
      process.stdout.write(`${usage(args.command === `legacy` ? null : args.command)}\n`)
      return
    }

    if (args.command === `upload-draft`) {
      const draftInfo = await createWechatDraftFromFile({
        accessToken: args.accessToken,
        appid: args.appid,
        filepath: args.filepath,
        secret: args.secret,
      })

      process.stdout.write(`${JSON.stringify(draftInfo, null, 2)}\n`)
      return
    }

    const html = await renderMarkdownFile(args.file, args.style)

    if (args.draft) {
      const draftInfo = await createWechatDraft({
        accessToken: args.accessToken,
        appid: args.appid,
        contentFilePath: args.file,
        html,
        secret: args.secret,
      })

      process.stdout.write(`${JSON.stringify(draftInfo, null, 2)}\n`)
      return
    }

    if (args.output) {
      await writeFile(args.output, html, `utf8`)
    }
    else {
      process.stdout.write(html)
    }

    if (args.copy) {
      await copyHtmlToClipboard(html)
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
