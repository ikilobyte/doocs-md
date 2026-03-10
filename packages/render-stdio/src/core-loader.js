import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)

let modulesPromise

export async function loadMdModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      jiti.import(`../../core/src/renderer/renderer-impl.ts`),
      jiti.import(`../../core/src/utils/markdownHelpers.ts`),
      jiti.import(`../../core/src/theme/cssProcessor.ts`),
      jiti.import(`../../core/src/theme/cssScopeWrapper.ts`),
      jiti.import(`../../core/src/theme/cssVariables.ts`),
      jiti.import(`../../shared/src/configs/style.ts`),
      jiti.import(`../../shared/src/configs/theme-options.ts`),
      jiti.import(`../../shared/src/configs/theme-css/node.ts`),
    ]).then(([
      renderer,
      markdownHelpers,
      cssProcessor,
      cssScopeWrapper,
      cssVariables,
      styleConfig,
      themeOptions,
      themeAssets,
    ]) => ({
      renderer,
      markdownHelpers,
      cssProcessor,
      cssScopeWrapper,
      cssVariables,
      styleConfig,
      themeOptions,
      themeAssets,
    }))
  }

  return modulesPromise
}
