import type { IConfigOption } from '../types'

export type ThemeName = 'default' | 'grace' | 'simple'

export const themeOptionsMap = {
  default: {
    label: `经典`,
    value: `default`,
    desc: ``,
  },
  grace: {
    label: `优雅`,
    value: `grace`,
    desc: `@brzhang`,
  },
  simple: {
    label: `简洁`,
    value: `simple`,
    desc: `@okooo5km`,
  },
} satisfies Record<ThemeName, IConfigOption<ThemeName>>

export const themeOptions: IConfigOption<ThemeName>[] = [
  themeOptionsMap.default,
  themeOptionsMap.grace,
  themeOptionsMap.simple,
]
