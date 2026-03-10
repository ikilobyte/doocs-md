import { loadMdModules } from './core-loader.js'
import { buildThemeCSS, normalizeThemeCSSForCopy } from './theme-service.js'
import { buildWechatHtml } from './wechat-html.js'

const PRIMARY_COLOR_VAR_REGEX = /var\(--md-primary-color\)/g
const FONT_FAMILY_VAR_REGEX = /var\(--md-font-family\)/g
const FONT_SIZE_VAR_REGEX = /var\(--md-font-size\)/g
const FOREGROUND_COLOR_REGEX = /hsl\(var\(--foreground\)\)/g
const BLOCKQUOTE_BACKGROUND_REGEX = /var\(--blockquote-background\)/g
const UNDEFINED_FONT_FAMILY_REGEX = /font-family:\s*undefined;/g
const UNDEFINED_FONT_SIZE_REGEX = /font-size:\s*undefined;/g
const UNDEFINED_CALC_REGEX = /calc\(undefined \* ([0-9.]+)\)/g
const UNDEFINED_SOLID_REGEX = /solid undefined/g
const UNDEFINED_VALUE_REGEX = /:\s*undefined;/g

async function fetchCodeThemeStyles(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`获取代码块主题失败: ${response.status} ${response.statusText}`)
  }

  return `<style>${await response.text()}</style>`
}

function buildCopyThemeStyles(themeCSS, styleConfig) {
  const copyCSS = normalizeThemeCSSForCopy(themeCSS)
    .replace(PRIMARY_COLOR_VAR_REGEX, styleConfig.primaryColor)
    .replace(FONT_FAMILY_VAR_REGEX, styleConfig.fontFamily)
    .replace(FONT_SIZE_VAR_REGEX, styleConfig.fontSize)
    .replace(FOREGROUND_COLOR_REGEX, `#3f3f3f`)
    .replace(BLOCKQUOTE_BACKGROUND_REGEX, `#f7f7f7`)

  return `<style>${copyCSS}</style>`
}

function normalizeUndefinedStyleValues(html, styleConfig) {
  const fontSize = Number.parseFloat(styleConfig.fontSize)
  const formatPx = factor => `${Number((fontSize * factor).toFixed(3))}px`

  return html
    .replace(UNDEFINED_FONT_FAMILY_REGEX, `font-family: ${styleConfig.fontFamily};`)
    .replace(UNDEFINED_FONT_SIZE_REGEX, `font-size: ${styleConfig.fontSize};`)
    .replace(UNDEFINED_CALC_REGEX, (_, factor) => formatPx(Number(factor)))
    .replace(UNDEFINED_SOLID_REGEX, `solid ${styleConfig.primaryColor}`)
    .replace(UNDEFINED_VALUE_REGEX, `: ${styleConfig.primaryColor};`)
}

export async function renderToWechatHtml(markdown, styleConfig) {
  const {
    markdownHelpers: {
      postProcessHtml,
      renderMarkdown,
    },
    renderer: {
      initRenderer,
    },
  } = await loadMdModules()

  const renderer = initRenderer()
  renderer.reset({
    citeStatus: styleConfig.isCiteStatus,
    countStatus: false,
    legend: styleConfig.legend,
    isMacCodeBlock: styleConfig.isMacCodeBlock,
    isShowLineNumber: styleConfig.isShowLineNumber,
    themeMode: `light`,
  })

  const { html: baseHtml, readingTime } = renderMarkdown(markdown, renderer)
  const renderedHtml = postProcessHtml(baseHtml, readingTime, renderer)

  const themeCSS = await buildThemeCSS({
    themeName: styleConfig.theme,
    customCSS: styleConfig.customCSS,
    variables: {
      primaryColor: styleConfig.primaryColor,
      fontFamily: styleConfig.fontFamily,
      fontSize: styleConfig.fontSize,
      isUseIndent: styleConfig.isUseIndent,
      isUseJustify: styleConfig.isUseJustify,
      headingStyles: styleConfig.headingStyles,
    },
  })

  const themeStyles = buildCopyThemeStyles(themeCSS, styleConfig)
  const highlightStyles = await fetchCodeThemeStyles(styleConfig.codeBlockTheme)

  const html = buildWechatHtml({
    html: renderedHtml,
    themeStyles,
    highlightStyles,
    primaryColor: styleConfig.primaryColor,
    headingStyles: styleConfig.headingStyles,
  })

  return normalizeUndefinedStyleValues(html, styleConfig)
}
