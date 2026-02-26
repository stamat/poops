import nunjucks from 'nunjucks'
import { discoverImageVariants } from '../utils/helpers.js'

export class GoogleFontsExtension {
  constructor() {
    this.tags = ['googleFonts']
  }

  parse(parser, nodes) {
    const tok = parser.nextToken()
    const args = parser.parseSignature(null, true)
    parser.advanceAfterBlockEnd(tok.value)
    return new nodes.CallExtension(this, 'run', args)
  }

  run(context, fonts, kwargs) {
    if (!fonts || (Array.isArray(fonts) && fonts.length === 0)) return ''

    if (typeof fonts === 'string') fonts = [fonts]

    const display = (kwargs && kwargs.display) || 'swap'

    const families = fonts.map(font => {
      if (typeof font === 'string') return `family=${font.replace(/\s+/g, '+')}`
      const name = font.name || font.family || ''
      const weights = font.weights || font.wght
      let param = `family=${name.replace(/\s+/g, '+')}`
      if (weights) {
        const wList = Array.isArray(weights) ? weights : [weights]
        param += `:wght@${wList.join(';')}`
      }
      if (font.ital) {
        param = param.replace(':wght@', ':ital,wght@')
        const wList = param.match(/@(.+)$/)[1].split(';')
        const expanded = []
        for (const w of wList) {
          expanded.push(`0,${w}`)
          expanded.push(`1,${w}`)
        }
        param = param.replace(/@.+$/, `@${expanded.join(';')}`)
      }
      return param
    })

    const url = `https://fonts.googleapis.com/css2?${families.join('&')}&display=${display}`

    return new nunjucks.runtime.SafeString(
      `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
      `<link href="${url}" rel="stylesheet">`
    )
  }
}

export class ImageExtension {
  constructor(getOutputDir) {
    this.tags = ['image']
    this.getOutputDir = getOutputDir
  }

  parse(parser, nodes) {
    const tok = parser.nextToken()
    const args = parser.parseSignature(null, true)
    parser.advanceAfterBlockEnd(tok.value)
    return new nodes.CallExtension(this, 'run', args)
  }

  run(context, imagePath, kwargs) {
    const outputDir = this.getOutputDir()
    const { src, variants } = discoverImageVariants(imagePath, outputDir)

    const prefix = context.lookup('relativePathPrefix') || ''
    const alt = (kwargs && kwargs.alt) || ''
    const sizes = (kwargs && kwargs.sizes) || '100vw'
    const loading = (kwargs && kwargs.loading) || 'lazy'

    const attrs = [`src="${prefix}${src}"`, `alt="${alt}"`]

    if (variants.length > 0) {
      const srcsetVal = variants.map(v => `${prefix}${v.path} ${v.width}w`).join(', ')
      attrs.push(`srcset="${srcsetVal}"`)
      attrs.push(`sizes="${sizes}"`)
    }

    attrs.push(`loading="${loading}"`)

    // Pass through any extra attributes
    if (kwargs) {
      const skip = new Set(['alt', 'sizes', 'loading'])
      for (const [key, val] of Object.entries(kwargs)) {
        if (key.startsWith('__') || skip.has(key)) continue
        attrs.push(`${key}="${val}"`)
      }
    }

    return new nunjucks.runtime.SafeString(`<img ${attrs.join(' ')}>`)
  }
}
