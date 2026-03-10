import { loadMdModules } from './core-loader.js'

const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g

export async function buildThemeCSS(styleConfig) {
  const {
    cssProcessor: { processCSS },
    cssScopeWrapper: { wrapCSSWithScope },
    cssVariables: { generateCSSVariables, generateHeadingStyles },
    themeAssets: { baseCSSContent, themeMap },
  } = await loadMdModules()

  const variablesCSS = generateCSSVariables({
    primaryColor: styleConfig.primaryColor,
    fontFamily: styleConfig.fontFamily,
    fontSize: styleConfig.fontSize,
    isUseIndent: styleConfig.isUseIndent,
    isUseJustify: styleConfig.isUseJustify,
    headingStyles: styleConfig.headingStyles,
  })

  let themeCSS = themeMap.default

  if (styleConfig.theme !== `default`) {
    const specificThemeCSS = themeMap[styleConfig.theme]
    if (specificThemeCSS) {
      themeCSS = `${themeCSS}\n\n${specificThemeCSS}`
    }
  }

  const scopedThemeCSS = wrapCSSWithScope(themeCSS, `#output`)
  const headingStylesCSS = generateHeadingStyles({
    primaryColor: styleConfig.primaryColor,
    fontFamily: styleConfig.fontFamily,
    fontSize: styleConfig.fontSize,
    isUseIndent: styleConfig.isUseIndent,
    isUseJustify: styleConfig.isUseJustify,
    headingStyles: styleConfig.headingStyles,
  })
  const scopedCustomCSS = styleConfig.customCSS
    ? wrapCSSWithScope(styleConfig.customCSS, `#output`)
    : ``

  return processCSS([
    variablesCSS,
    baseCSSContent,
    scopedThemeCSS,
    headingStylesCSS,
    scopedCustomCSS,
  ].filter(Boolean).join(`\n\n`))
}

export function normalizeThemeCSSForCopy(
  cssContent,
  scopeSelector = `#output`,
  rootSelector = `body`,
) {
  let normalizedCSS = cssContent
  const escapedScopeSelector = scopeSelector.replace(REGEX_ESCAPE_PATTERN, `\\$&`)
  const scopeRegex = new RegExp(escapedScopeSelector, `g`)

  normalizedCSS = normalizedCSS.replace(new RegExp(`${escapedScopeSelector}\\s*\\{`, `g`), `${rootSelector} {`)
  normalizedCSS = normalizedCSS.replace(new RegExp(`${escapedScopeSelector}\\s+`, `g`), ``)
  normalizedCSS = normalizedCSS.replace(new RegExp(`^${escapedScopeSelector}\\s*`, `gm`), ``)
  normalizedCSS = normalizedCSS.replace(scopeRegex, rootSelector)

  return normalizedCSS
}
