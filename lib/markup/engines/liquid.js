import fs from 'node:fs'
import path from 'node:path'
import { Liquid } from 'liquidjs'
import { highlightCode } from '../highlight.js'
import { marked } from '../renderer.js'
import { discoverImageVariants, parseFrontMatter, groupby, decodeTemplateEntities, buildImageTag, renderToc } from '../helpers.js'
import { getImageExif, listImages } from '../image-cache.js'
import { slugify } from 'book-of-spells'
import dayjs from 'dayjs'

export default class LiquidEngine {
  constructor(templatesDir, includePaths) {
    const roots = [templatesDir]
    for (const inc of includePaths || []) {
      roots.push(path.resolve(templatesDir, inc))
    }
    // Also add any _* directories as include roots
    try {
      const entries = fs.readdirSync(templatesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('_')) {
          roots.push(path.join(templatesDir, entry.name))
        }
      }
    } catch { /* ignore */ }

    this.engine = new Liquid({
      root: roots,
      extname: '.liquid',
      cache: false,
      dynamicPartials: true,
      strictFilters: false,
      strictVariables: false,
      jsTruthy: true
    })

    this.globals = {}
  }

  get fileExtension() { return '.liquid' }
  get indexableExtensions() { return new Set(['.html', '.md', '.liquid']) }
  get markupExtensions() { return 'html|xml|rss|atom|json|liquid|md' }

  registerFilters({ timeDateFormat, markupOut }) {
    const engine = this.engine
    engine.registerFilter('slugify', (str) => slugify(str))
    engine.registerFilter('jsonify', (obj) => JSON.stringify(obj))
    engine.registerFilter('markdown', (str) => marked.parse(str))
    engine.registerFilter('toc', (html) => renderToc(String(html || '')))
    engine.registerFilter('date', (str, template) => {
      const fmt = template || timeDateFormat
      if (!fmt) return str
      const date = !str || (typeof str === 'string' && str.trim() === '') ? new Date() : new Date(str)
      return dayjs(date).format(fmt)
    })
    engine.registerFilter('concat', (arr, value) => {
      if (!Array.isArray(arr)) return [value]
      return arr.concat(value)
    })
    engine.registerFilter('push', (arr, value) => {
      if (!Array.isArray(arr)) return [value]
      arr.push(value)
      return arr
    })
    engine.registerFilter('svg', (filePath) => {
      const fullPath = path.resolve(process.cwd(), filePath)
      if (!fs.existsSync(fullPath)) return ''
      const content = fs.readFileSync(fullPath, 'utf-8').trim()
      if (!/^(<\?xml[^?]*\?>\s*)?<svg[\s>]/i.test(content)) return ''
      return content
    })
    engine.registerFilter('srcset', (imagePath) => {
      const outputDir = path.resolve(process.cwd(), markupOut)
      const { variants } = discoverImageVariants(imagePath, outputDir)
      if (variants.length === 0) return ''
      return variants.map(v => `${v.path} ${v.width}w`).join(', ')
    })
    engine.registerFilter('exif', (imagePath) => {
      const outputDir = path.resolve(process.cwd(), markupOut)
      return getImageExif(imagePath, outputDir)
    })
    engine.registerFilter('images', (dirPath) => {
      const outputDir = path.resolve(process.cwd(), markupOut)
      return listImages(dirPath, outputDir)
    })
    engine.registerFilter('groupby', (arr, key, datePart) => groupby(arr, key, datePart))
    engine.registerFilter('highlight', (code, lang) => {
      const highlighted = highlightCode(code, lang)
      const langClass = lang ? ` language-${lang}` : ''
      return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`
    })
  }

  registerTags(getOutputDir) {
    registerGoogleFontsTag(this.engine)
    registerImageTag(this.engine, getOutputDir)
    registerHighlightTag(this.engine)
  }

  setGlobal(key, value) {
    this.globals[key] = value
  }

  removeGlobal(key) {
    delete this.globals[key]
  }

  async render(templateName, context) {
    let source
    const frontMatterResult = parseFrontMatter(templateName)
    source = frontMatterResult.content

    if (path.extname(templateName) === '.md') {
      source = decodeTemplateEntities(marked.parse(source))
    }

    const frontMatter = context.page || {}
    if (frontMatter.layout) {
      source = `{% layout '${frontMatter.layout}${this.fileExtension}' %}{% block content %}${source}{% endblock %}`
    }

    return this.engine.parseAndRender(source, { ...this.globals, ...context }, {
      globals: this.globals
    })
  }

  async renderString(source, context) {
    return this.engine.parseAndRender(source, { ...this.globals, ...context }, {
      globals: this.globals
    })
  }
}

// --- Liquid Tags ---

function registerGoogleFontsTag(engine) {
  engine.registerTag('googleFonts', {
    parse(tagToken) {
      this.value = tagToken.args.trim()
    },
    * render(ctx) {
      const fonts = yield this.liquid.evalValue(this.value, ctx)
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
          for (const w of wList) { expanded.push(`0,${w}`); expanded.push(`1,${w}`) }
          param = param.replace(/@.+$/, `@${expanded.join(';')}`)
        }
        return param
      })

      const url = `https://fonts.googleapis.com/css2?${families.join('&')}&display=${display}`
      return `<link rel="preconnect" href="https://fonts.googleapis.com">\n
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n
        <link href="${url}" rel="stylesheet">`
    }
  })
}

function registerImageTag(engine, getOutputDir) {
  engine.registerTag('image', {
    parse(tagToken) {
      this.args = tagToken.args
    },
    * render(ctx) {
      const argsStr = this.args.trim()
      const parts = argsStr.split(',').map(s => s.trim())

      let imagePath = parts[0]
      if (imagePath.startsWith('"') || imagePath.startsWith("'")) {
        imagePath = imagePath.slice(1, -1)
      } else {
        imagePath = yield ctx.get(imagePath.split('.'))
      }

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
      return buildImageTag(imagePath, prefix, kwargs, getOutputDir)
    }
  })
}

function registerHighlightTag(engine) {
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
