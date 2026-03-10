import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const HEADING_LEVELS = new Set([`h1`, `h2`, `h3`, `h4`, `h5`, `h6`])

function assertObject(value, label) {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    throw new TypeError(`${label} 必须是 JSON 对象`)
  }
}

function assertString(value, label) {
  if (typeof value !== `string` || value.trim() === ``) {
    throw new TypeError(`${label} 必须是非空字符串`)
  }
}

function assertBoolean(value, label) {
  if (typeof value !== `boolean`) {
    throw new TypeError(`${label} 必须是布尔值`)
  }
}

function validateOption(value, label, options) {
  const validValues = new Set(options.map(item => item.value))
  if (!validValues.has(value)) {
    throw new Error(`${label} 的值不符合现有渲染逻辑`)
  }
}

function validateHeadingStyles(headingStyles, headingStyleOptions) {
  assertObject(headingStyles, `headingStyles`)

  const validStyleValues = new Set(headingStyleOptions.map(item => item.value))

  for (const [level, style] of Object.entries(headingStyles)) {
    if (!HEADING_LEVELS.has(level)) {
      throw new Error(`headingStyles.${level} 不是合法的标题级别`)
    }
    if (typeof style !== `string` || !validStyleValues.has(style)) {
      throw new Error(`headingStyles.${level} 的值不符合现有渲染逻辑`)
    }
  }
}

function extractCustomCSS(cssContentConfig) {
  assertObject(cssContentConfig, `cssContentConfig`)

  const { active, tabs } = cssContentConfig

  if (!Array.isArray(tabs) || tabs.length === 0) {
    throw new Error(`cssContentConfig.tabs 必须是非空数组`)
  }

  if (typeof active !== `string` || active.trim() === ``) {
    throw new Error(`cssContentConfig.active 必须是非空字符串`)
  }

  const currentTab = tabs.find(tab => tab?.name === active) || tabs[0]
  assertObject(currentTab, `cssContentConfig.tabs[]`)
  assertString(currentTab.content, `cssContentConfig.tabs[].content`)

  return currentTab.content
}

export async function loadStyleConfig(stylePath, sharedConfigModules) {
  const {
    styleConfig: {
      codeBlockThemeOptions,
      defaultStyleConfig,
      fontFamilyOptions,
      fontSizeOptions,
      headingStyleOptions,
      legendOptions,
    },
    themeOptions: { themeOptions },
  } = sharedConfigModules

  const normalized = {
    theme: defaultStyleConfig.theme,
    fontFamily: defaultStyleConfig.fontFamily,
    fontSize: defaultStyleConfig.fontSize,
    primaryColor: defaultStyleConfig.primaryColor,
    codeBlockTheme: defaultStyleConfig.codeBlockTheme,
    legend: defaultStyleConfig.legend,
    isMacCodeBlock: defaultStyleConfig.isMacCodeBlock,
    isShowLineNumber: defaultStyleConfig.isShowLineNumber,
    isCiteStatus: defaultStyleConfig.isCiteStatus,
    isUseIndent: false,
    isUseJustify: false,
    headingStyles: { ...defaultStyleConfig.headingStyles },
    customCSS: ``,
    stylePath: stylePath ? resolve(stylePath) : null,
  }

  if (!stylePath) {
    return normalized
  }

  const styleContent = await readFile(normalized.stylePath, `utf8`)
  const parsed = JSON.parse(styleContent)
  assertObject(parsed, `样式配置`)

  if (Object.hasOwn(parsed, `theme`)) {
    assertString(parsed.theme, `theme`)
    validateOption(parsed.theme, `theme`, themeOptions)
    normalized.theme = parsed.theme
  }

  if (Object.hasOwn(parsed, `fontFamily`)) {
    assertString(parsed.fontFamily, `fontFamily`)
    validateOption(parsed.fontFamily, `fontFamily`, fontFamilyOptions)
    normalized.fontFamily = parsed.fontFamily
  }

  if (Object.hasOwn(parsed, `fontSize`)) {
    assertString(parsed.fontSize, `fontSize`)
    validateOption(parsed.fontSize, `fontSize`, fontSizeOptions)
    normalized.fontSize = parsed.fontSize
  }

  if (Object.hasOwn(parsed, `primaryColor`)) {
    assertString(parsed.primaryColor, `primaryColor`)
    normalized.primaryColor = parsed.primaryColor
  }

  if (Object.hasOwn(parsed, `codeBlockTheme`)) {
    assertString(parsed.codeBlockTheme, `codeBlockTheme`)
    validateOption(parsed.codeBlockTheme, `codeBlockTheme`, codeBlockThemeOptions)
    normalized.codeBlockTheme = parsed.codeBlockTheme
  }

  if (Object.hasOwn(parsed, `legend`)) {
    assertString(parsed.legend, `legend`)
    validateOption(parsed.legend, `legend`, legendOptions)
    normalized.legend = parsed.legend
  }

  if (Object.hasOwn(parsed, `isMacCodeBlock`)) {
    assertBoolean(parsed.isMacCodeBlock, `isMacCodeBlock`)
    normalized.isMacCodeBlock = parsed.isMacCodeBlock
  }

  if (Object.hasOwn(parsed, `isShowLineNumber`)) {
    assertBoolean(parsed.isShowLineNumber, `isShowLineNumber`)
    normalized.isShowLineNumber = parsed.isShowLineNumber
  }

  if (Object.hasOwn(parsed, `isCiteStatus`)) {
    assertBoolean(parsed.isCiteStatus, `isCiteStatus`)
    normalized.isCiteStatus = parsed.isCiteStatus
  }

  if (Object.hasOwn(parsed, `isUseIndent`)) {
    assertBoolean(parsed.isUseIndent, `isUseIndent`)
    normalized.isUseIndent = parsed.isUseIndent
  }

  if (Object.hasOwn(parsed, `isUseJustify`)) {
    assertBoolean(parsed.isUseJustify, `isUseJustify`)
    normalized.isUseJustify = parsed.isUseJustify
  }

  if (Object.hasOwn(parsed, `headingStyles`)) {
    validateHeadingStyles(parsed.headingStyles, headingStyleOptions)
    normalized.headingStyles = { ...parsed.headingStyles }
  }

  if (Object.hasOwn(parsed, `cssContentConfig`)) {
    normalized.customCSS = extractCustomCSS(parsed.cssContentConfig)
  }

  return normalized
}
