import { discoverImageVariants } from '../utils/helpers.js'
import { highlightCode } from '../markup/highlight.js'

export class GoogleFontsTag {
  constructor(engine) {
    engine.registerTag('googleFonts', {
      parse(tagToken) {
        this.value = tagToken.args.trim()
      },
      * render(ctx) {
        let fonts = yield this.liquid.evalValue(this.value, ctx)

        if (!fonts || (Array.isArray(fonts) && fonts.length === 0)) return ''

        const fontList = typeof fonts === 'string' ? [fonts] : fonts
        const display = 'swap'

        const families = fontList.map(font => {
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

        return `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
          `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
          `<link href="${url}" rel="stylesheet">`
      }
    })
  }
}

export class ImageTag {
  constructor(engine, getOutputDir) {
    engine.registerTag('image', {
      parse(tagToken) {
        this.args = tagToken.args
      },
      * render(ctx) {
        // Parse: image "path/to/img.jpg", alt: "Alt text", loading: "lazy", sizes: "100vw"
        const argsStr = this.args.trim()
        const parts = argsStr.split(',').map(s => s.trim())

        // First part is the image path (may be quoted or a variable)
        let imagePath = parts[0]
        if (imagePath.startsWith('"') || imagePath.startsWith("'")) {
          imagePath = imagePath.slice(1, -1)
        } else {
          imagePath = yield ctx.get(imagePath.split('.'))
        }

        // Parse keyword arguments
        const kwargs = {}
        for (let i = 1; i < parts.length; i++) {
          const colonIdx = parts[i].indexOf(':')
          if (colonIdx === -1) continue
          const key = parts[i].slice(0, colonIdx).trim()
          let val = parts[i].slice(colonIdx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          kwargs[key] = val
        }

        const prefix = (yield ctx.get(['relativePathPrefix'])) || ''
        const alt = kwargs.alt || ''
        const loading = kwargs.loading || 'lazy'
        const isSvg = imagePath.endsWith('.svg')

        const attrs = [`alt="${alt}"`]

        if (isSvg) {
          attrs.unshift(`src="${prefix}${imagePath}"`)
        } else {
          const outputDir = getOutputDir()
          const { src, variants } = discoverImageVariants(imagePath, outputDir)
          const sizes = kwargs.sizes || '100vw'

          attrs.unshift(`src="${prefix}${src}"`)

          if (variants.length > 0) {
            const srcsetVal = variants.map(v => `${prefix}${v.path} ${v.width}w`).join(', ')
            attrs.push(`srcset="${srcsetVal}"`)
            attrs.push(`sizes="${sizes}"`)
          }
        }

        attrs.push(`loading="${loading}"`)

        // Pass through extra attributes
        const skip = new Set(['alt', 'sizes', 'loading'])
        for (const [key, val] of Object.entries(kwargs)) {
          if (skip.has(key)) continue
          attrs.push(`${key}="${val}"`)
        }

        return `<img ${attrs.join(' ')}>`
      }
    })
  }
}

export class HighlightTag {
  constructor(engine) {
    engine.registerTag('highlight', {
      parse(tagToken, remainTokens) {
        this.lang = tagToken.args.trim()
        this.templates = []
        const stream = this.liquid.parser.parseStream(remainTokens)
          .on('tag:endhighlight', () => stream.stop())
          .on('template', (tpl) => this.templates.push(tpl))
          .on('end', () => { throw new Error('tag {% highlight %} not closed with {% endhighlight %}') })
        stream.start()
      },
      * render(ctx) {
        const code = yield this.liquid.renderer.renderTemplates(this.templates, ctx)
        const lang = this.lang
        const highlighted = highlightCode(code, lang)
        const langClass = lang ? ` language-${lang}` : ''
        return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`
      }
    })
  }
}

export function registerTags(engine, getOutputDir) {
  new GoogleFontsTag(engine)
  new ImageTag(engine, getOutputDir)
  new HighlightTag(engine)
}
