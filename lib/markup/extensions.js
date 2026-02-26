import nunjucks from 'nunjucks'
import { discoverImageVariants } from '../utils/helpers.js'

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
