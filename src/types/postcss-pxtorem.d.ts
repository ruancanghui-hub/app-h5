declare module 'postcss-pxtorem' {
  import type { Plugin } from 'postcss'

  interface Options {
    rootValue?: number | ((input: { file?: string }) => number)
    unitPrecision?: number
    propList?: string[]
    selectorBlackList?: (string | RegExp)[]
    replace?: boolean
    mediaQuery?: boolean
    minPixelValue?: number
    exclude?: string | RegExp | ((file: string) => boolean)
  }

  export default function postcssPxToRem(options?: Options): Plugin
}
