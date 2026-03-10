import { readFileSync } from 'node:fs'

function readCss(fileName: string): string {
  return readFileSync(new URL(`./${fileName}`, import.meta.url), `utf8`)
}

export const baseCSSContent = readCss(`base.css`)

export const themeMap = {
  default: readCss(`default.css`),
  grace: readCss(`grace.css`),
  simple: readCss(`simple.css`),
} as const
