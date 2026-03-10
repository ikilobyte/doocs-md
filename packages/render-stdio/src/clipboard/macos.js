import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const APPLE_SCRIPT_LINES = [
  `use framework "AppKit"`,
  `use framework "Foundation"`,
  `use scripting additions`,
  ``,
  `on run argv`,
  `  set htmlPath to item 1 of argv`,
  `  set htmlData to current application's NSData's dataWithContentsOfFile_(htmlPath)`,
  `  if htmlData is missing value then error "Failed to read HTML temp file"`,
  ``,
  `  set pasteboard to current application's NSPasteboard's generalPasteboard()`,
  `  set htmlType to current application's NSPasteboardTypeHTML`,
  `  set declaredTypes to current application's NSArray's arrayWithObject_(htmlType)`,
  `  pasteboard's declareTypes_owner_(declaredTypes, missing value)`,
  ``,
  `  set ok to pasteboard's setData_forType_(htmlData, htmlType)`,
  `  if (ok as boolean) is false then error "Failed to write HTML clipboard"`,
  `end run`,
]

function buildAppleScriptArgs(htmlPath) {
  return [
    ...APPLE_SCRIPT_LINES.flatMap(line => [`-e`, line]),
    htmlPath,
  ]
}

export async function copyHtmlToMacOSClipboard(html) {
  const tempDir = await mkdtemp(join(tmpdir(), `md-stdio-clipboard-`))
  const htmlPath = join(tempDir, `clipboard.html`)

  try {
    await writeFile(htmlPath, html, `utf8`)
    await execFileAsync(`osascript`, buildAppleScriptArgs(htmlPath))
  }
  catch (error) {
    if (error instanceof Error && `code` in error && error.code === `ENOENT`) {
      throw new Error(`未找到 osascript，无法执行 --copy`)
    }

    const stderr = error && typeof error === `object` && `stderr` in error
      ? String(error.stderr).trim()
      : ``
    const message = stderr || (error instanceof Error ? error.message : String(error))
    throw new Error(`复制到 macOS 剪贴板失败: ${message}`)
  }
  finally {
    await rm(tempDir, { force: true, recursive: true })
  }
}
