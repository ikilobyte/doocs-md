import process from 'node:process'
import { copyHtmlToMacOSClipboard } from './macos.js'

export async function copyHtmlToClipboard(html) {
  if (process.platform !== `darwin`) {
    throw new Error(`--copy 目前只支持 macOS`)
  }

  await copyHtmlToMacOSClipboard(html)
}
