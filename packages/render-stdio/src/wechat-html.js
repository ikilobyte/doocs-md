import juice from 'juice'
import { parseHTML } from 'linkedom'

const NUMERIC_SIZE_PATTERN = /^\d+$/
const TOP_OFFSET_REGEX = /([^-])top:(.*?)em/g
const FOREGROUND_COLOR_REGEX = /hsl\(var\(--foreground\)\)/g
const BLOCKQUOTE_BACKGROUND_REGEX = /var\(--blockquote-background\)/g
const PRIMARY_COLOR_VAR_REGEX = /var\(--md-primary-color\)/g
const PRIMARY_COLOR_DECLARATION_REGEX = /--md-primary-color:.+?;/g
const FONT_FAMILY_DECLARATION_REGEX = /--md-font-family:.+?;/g
const FONT_SIZE_DECLARATION_REGEX = /--md-font-size:.+?;/g
const NODE_LABEL_PARAGRAPH_REGEX = /<span class="nodeLabel"([^>]*)><p[^>]*>(.*?)<\/p><\/span>/g
const EDGE_LABEL_PARAGRAPH_REGEX = /<span class="edgeLabel"([^>]*)><p[^>]*>(.*?)<\/p><\/span>/g

function mergeCss(html) {
  return juice(html, {
    inlinePseudoElements: true,
    preserveImportant: true,
    resolveCSSVariables: false,
  })
}

function createRootDocument(html = ``) {
  const { document } = parseHTML(`<!doctype html><html><body><section id="root"></section></body></html>`)
  const root = document.getElementById(`root`)
  root.innerHTML = html
  return { document, root }
}

function moveNestedLists(root) {
  root.querySelectorAll(`li > ul, li > ol`).forEach((nestedList) => {
    nestedList.parentElement?.insertAdjacentElement(`afterend`, nestedList)
  })
}

function createEmptyNode(document) {
  const node = document.createElement(`p`)
  node.style.fontSize = `0`
  node.style.lineHeight = `0`
  node.style.margin = `0`
  node.innerHTML = `&nbsp;`
  return node
}

function solveWeChatImage(root) {
  root.querySelectorAll(`img`).forEach((image) => {
    const width = image.getAttribute(`width`)
    const height = image.getAttribute(`height`)

    if (width) {
      image.removeAttribute(`width`)
      image.style.width = NUMERIC_SIZE_PATTERN.test(width) ? `${width}px` : width
    }

    if (height) {
      image.removeAttribute(`height`)
      image.style.height = NUMERIC_SIZE_PATTERN.test(height) ? `${height}px` : height
    }
  })
}

function normalizeMermaidNodes(root, document) {
  root.querySelectorAll(`.nodeLabel`).forEach((node) => {
    const parent = node.parentElement
    if (!parent) {
      return
    }

    const grandParent = parent.parentElement
    if (!grandParent) {
      return
    }

    const section = document.createElement(`section`)
    const xmlns = parent.getAttribute(`xmlns`)
    const style = parent.getAttribute(`style`)

    if (xmlns) {
      section.setAttribute(`xmlns`, xmlns)
    }

    if (style) {
      section.setAttribute(`style`, style)
    }

    section.innerHTML = parent.innerHTML
    grandParent.innerHTML = ``
    grandParent.appendChild(section)
  })
}

function normalizeMermaidText(root) {
  root.querySelectorAll(`tspan`).forEach((node) => {
    const existingStyle = node.getAttribute(`style`)
    const forcedStyle = `fill: #333333 !important; color: #333333 !important; stroke: none !important;`
    node.setAttribute(`style`, existingStyle ? `${existingStyle} ${forcedStyle}` : forcedStyle)
  })
}

function normalizeInfographicText(root) {
  const variantMap = {
    'alphabetic': ``,
    'central': `0.35em`,
    'middle': `0.35em`,
    'hanging': `-0.55em`,
    'ideographic': `0.18em`,
    'text-before-edge': `-0.85em`,
    'text-after-edge': `0.15em`,
  }

  root.querySelectorAll(`.infographic-diagram text`).forEach((textNode) => {
    const dominantBaseline = textNode.getAttribute(`dominant-baseline`)
    if (!dominantBaseline) {
      return
    }

    textNode.removeAttribute(`dominant-baseline`)
    const dy = variantMap[dominantBaseline]
    if (dy) {
      textNode.setAttribute(`dy`, dy)
    }
  })
}

function applyHeadingStyleOverrides(root, headingStyles = {}, primaryColor) {
  for (const [level, style] of Object.entries(headingStyles)) {
    if (!style || style === `default` || style === `custom`) {
      continue
    }

    root.querySelectorAll(level).forEach((heading) => {
      heading.style.display = `block`
      heading.style.textAlign = `left`
      heading.style.background = `transparent`

      if (style === `color-only`) {
        heading.style.color = primaryColor
        heading.style.removeProperty(`border-left`)
        heading.style.removeProperty(`border-bottom`)
        return
      }

      if (style === `border-bottom`) {
        heading.style.color = primaryColor
        heading.style.paddingBottom = `0.3em`
        heading.style.borderBottom = `2px solid ${primaryColor}`
        heading.style.removeProperty(`border-left`)
        heading.style.paddingLeft = `0`
        return
      }

      if (style === `border-left`) {
        heading.style.color = primaryColor
        heading.style.marginLeft = `0`
        heading.style.paddingLeft = `10px`
        heading.style.borderLeft = `4px solid ${primaryColor}`
        heading.style.removeProperty(`border-bottom`)
      }
    })
  }
}

function applyStringFixes(html, primaryColor) {
  return html
    .replace(TOP_OFFSET_REGEX, `$1transform: translateY($2em)`)
    .replace(FOREGROUND_COLOR_REGEX, `#3f3f3f`)
    .replace(BLOCKQUOTE_BACKGROUND_REGEX, `#f7f7f7`)
    .replace(PRIMARY_COLOR_VAR_REGEX, primaryColor)
    .replace(PRIMARY_COLOR_DECLARATION_REGEX, ``)
    .replace(FONT_FAMILY_DECLARATION_REGEX, ``)
    .replace(FONT_SIZE_DECLARATION_REGEX, ``)
    .replace(
      NODE_LABEL_PARAGRAPH_REGEX,
      `<span class="nodeLabel"$1>$2</span>`,
    )
    .replace(
      EDGE_LABEL_PARAGRAPH_REGEX,
      `<span class="edgeLabel"$1>$2</span>`,
    )
}

export function buildWechatHtml({
  html,
  themeStyles = ``,
  highlightStyles = ``,
  primaryColor,
  headingStyles = {},
}) {
  const source = [themeStyles, highlightStyles, html].filter(Boolean).join(``)

  const merged = mergeCss(source)
  const movedLists = createRootDocument(merged)
  moveNestedLists(movedLists.root)

  const normalized = applyStringFixes(movedLists.root.innerHTML, primaryColor)
  const { document, root } = createRootDocument(normalized)

  solveWeChatImage(root)

  root.insertBefore(createEmptyNode(document), root.firstChild)
  root.appendChild(createEmptyNode(document))

  normalizeMermaidNodes(root, document)
  normalizeMermaidText(root)
  normalizeInfographicText(root)
  applyHeadingStyleOverrides(root, headingStyles, primaryColor)

  return root.innerHTML
}
