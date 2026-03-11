import { parseHTML } from 'linkedom'

const MULTIPLE_SPACES_PATTERN = /\s+/g
const TITLE_TAGS = [`h1`, `h2`, `h3`]

function createRootDocument(html = ``) {
  const { document } = parseHTML(`<!doctype html><html><body><section id="root"></section></body></html>`)
  const root = document.getElementById(`root`)
  root.innerHTML = html
  return { root }
}

function normalizeHeadingText(value) {
  return value.replace(MULTIPLE_SPACES_PATTERN, ` `).trim()
}

export function extractArticleTitle(html) {
  const { root } = createRootDocument(html)

  for (const tagName of TITLE_TAGS) {
    const heading = root.querySelector(tagName)
    const title = normalizeHeadingText(heading?.textContent || ``)

    if (title) {
      return title
    }
  }

  throw new Error(`未找到可用标题，上传草稿至少需要一个 h1、h2 或 h3 标题`)
}
