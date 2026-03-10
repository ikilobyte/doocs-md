import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { copyHtmlToClipboard } from './clipboard/index.js'
import { loadStyleConfig } from './config.js'
import { loadMdModules } from './core-loader.js'
import { renderToWechatHtml } from './render-service.js'

function usage() {
  return [
    `Usage: md-stdio --file /path/to/article.md [--style /path/to/style.json] [--copy]`,
    ``,
    `Options:`,
    `  --file   Markdown 文件路径`,
    `  --style  样式配置 JSON 路径`,
    `  --copy   复制最终 HTML 到 macOS 剪贴板 (text/html)`,
    `  --help   显示帮助`,
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

export function parseArgs(argv) {
  const normalizedArgv = argv[0] === `--` ? argv.slice(1) : argv
  const parsed = {
    file: null,
    style: null,
    copy: false,
    help: false,
  }

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const current = normalizedArgv[index]

    if (current === `--help`) {
      parsed.help = true
      continue
    }

    if (current === `--copy`) {
      parsed.copy = true
      continue
    }

    if (current === `--file` || current.startsWith(`--file=`)) {
      parsed.file = resolve(readOptionValue(normalizedArgv, index, `--file`))
      if (current === `--file`) {
        index += 1
      }
      continue
    }

    if (current === `--style` || current.startsWith(`--style=`)) {
      parsed.style = resolve(readOptionValue(normalizedArgv, index, `--style`))
      if (current === `--style`) {
        index += 1
      }
      continue
    }

    throw new Error(`未知参数: ${current}`)
  }

  if (!parsed.help && !parsed.file) {
    throw new Error(`缺少 --file 参数`)
  }

  return parsed
}

export async function run(argv) {
  try {
    const args = parseArgs(argv)

    if (args.help) {
      process.stdout.write(`${usage()}\n`)
      return
    }

    const markdown = await readFile(args.file, `utf8`)
    const mdModules = await loadMdModules()
    const styleConfig = await loadStyleConfig(args.style, mdModules)
    const html = await renderToWechatHtml(markdown, styleConfig)

    process.stdout.write(html)

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
