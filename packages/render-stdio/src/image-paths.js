import { dirname, isAbsolute, resolve } from 'node:path'
import { parseHTML } from 'linkedom'

const DATA_URL_PATTERN = /^data:/iu
const HTTP_IMAGE_PATTERN = /^https?:\/\//iu
const PROTOCOL_RELATIVE_IMAGE_PATTERN = /^\/\//u

function createRootDocument(html = ``) {
  const { document } = parseHTML(`<!doctype html><html><body><section id="root"></section></body></html>`)
  const root = document.getElementById(`root`)
  root.innerHTML = html
  return { root }
}

function shouldKeepImageSource(src) {
  return (
    !src
    || DATA_URL_PATTERN.test(src)
    || HTTP_IMAGE_PATTERN.test(src)
    || PROTOCOL_RELATIVE_IMAGE_PATTERN.test(src)
    || isAbsolute(src)
  )
}

export function rewriteRelativeImageSources(html, contentFilePath) {
  if (!contentFilePath) {
    return html
  }

  const { root } = createRootDocument(html)
  const contentDir = dirname(contentFilePath)

  root.querySelectorAll(`img[src]`).forEach((image) => {
    const src = image.getAttribute(`src`) || ``
    if (shouldKeepImageSource(src)) {
      return
    }

    image.setAttribute(`src`, resolve(contentDir, src))
  })

  return root.innerHTML
}
