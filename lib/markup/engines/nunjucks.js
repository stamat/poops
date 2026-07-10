import fs from 'node:fs'
import { globSync } from 'glob'
import nunjucks from 'nunjucks'
import path from 'node:path'
import { discoverImageVariants, parseFrontMatter, groupby, decodeTemplateEntities, buildImageTag, renderToc } from '../helpers.js'
import { getImageExif, listImages } from '../image-cache.js'
import { toPosix } from '../../utils/helpers.js'
import { highlightCode } from '../highlight.js'
import { marked } from '../renderer.js'
import { slugify } from 'book-of-spells'
import dayjs from 'dayjs'
import log from '../../utils/log.js'

class RelativeLoader extends nunjucks.Loader {
  constructor(templatesDir, includePaths) {
    super()
    this.templatesDir = templatesDir
    this.includePaths = includePaths || []
    this.includePaths.push('_*')
  }

  getSource(name) {
    let fullPath = name
    if (!fs.existsSync(name)) {
      let pattern = `**/${name}`
      if (this.includePaths) {
        pattern = `{${this.includePaths.join(',')}}/${pattern}`
      }
      fullPath = globSync(toPosix(path.join(this.templatesDir, pattern)))[0]
    }
    if (!fs.existsSync(fullPath)) {
      log({ tag: 'markup', error: true, text: 'Template not found:', link: name })
      return { src: '', path: fullPath, noCache: true }
    }

    let source = ''
    let frontMatter = {}

    try {
      const frontMatterResult = parseFrontMatter(fullPath)
      frontMatter = frontMatterResult.frontMatter
      source = frontMatterResult.content
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: fullPath })
      console.error(err)
    }

    if (path.extname(fullPath) === '.md') {
      source = decodeTemplateEntities(marked.parse(source))
    }

    if (frontMatter.layout) {
      source = `{% extends '${frontMatter.layout}.html' %}\n{% block content %}\n${source}\n{% endblock %}`
    }

    return { src: source, path: fullPath, noCache: true }
  }

  resolve(from, to) {
    return path.resolve(path.dirname(from), to)
  }
}

export default class NunjucksEngine {
  constructor(templatesDir, includePaths, options) {
    const autoescape = (options && options.autoescape) || false

    this.env = new nunjucks.Environment(
      new RelativeLoader(templatesDir, includePaths),
      { autoescape, watch: false, noCache: true }
    )
  }

  get fileExtension() { return '.njk' }
  get indexableExtensions() { return new Set(['.html', '.md', '.njk']) }
  get markupExtensions() { return 'html|xml|rss|atom|json|njk|md' }

  registerFilters({ timeDateFormat, markupOut }) {
    const env = this.env
    env.addFilter('slugify', slugify)
    env.addFilter('jsonify', (obj) => JSON.stringify(obj))
    env.addFilter('markdown', (str) => marked.parse(str))
    env.addFilter('toc', (html) => {
      const toc = renderToc(String(html || ''))
      // plain '' (falsy) when there are no headings, so `{% if x | toc %}` can
      // skip an empty TOC column; SafeString otherwise to keep the markup raw
      return toc ? new nunjucks.runtime.SafeString(toc) : ''
    })
    env.addFilter('concat', (arr, value) => {
      if (!Array.isArray(arr)) return [value]
      return arr.concat(value)
    })
    env.addFilter('push', (arr, value) => {
      if (!Array.isArray(arr)) return [value]
      arr.push(value)
      return arr
    })
    env.addFilter('svg', (filePath) => {
      const fullPath = path.resolve(process.cwd(), filePath)
      if (!fs.existsSync(fullPath)) return ''
      const content = fs.readFileSync(fullPath, 'utf-8').trim()
      if (!/^(<\?xml[^?]*\?>\s*)?<svg[\s>]/i.test(content)) return ''
      return new nunjucks.runtime.SafeString(content)
    })
    env.addFilter('date', (str, template) => {
      const fmt = template || timeDateFormat
      if (!fmt) return str
      const date = !str || str.trim() === '' ? new Date() : new Date(str)
      return dayjs(date).format(fmt)
    })
    env.addFilter('srcset', (imagePath) => {
      const outputDir = path.join(process.cwd(), markupOut)
      const { variants } = discoverImageVariants(imagePath, outputDir)
      if (variants.length === 0) return ''
      return variants.map(v => `${v.path} ${v.width}w`).join(', ')
    })
    env.addFilter('exif', (imagePath) => {
      const outputDir = path.join(process.cwd(), markupOut)
      return getImageExif(imagePath, outputDir)
    })
    env.addFilter('images', (dirPath) => {
      const outputDir = path.join(process.cwd(), markupOut)
      return listImages(dirPath, outputDir)
    })
    env.addFilter('groupby', (arr, key, datePart) => groupby(arr, key, datePart))
    env.addFilter('highlight', (code, lang) => {
      const highlighted = highlightCode(code, lang)
      const langClass = lang ? ` language-${lang}` : ''
      return new nunjucks.runtime.SafeString(`<pre><code class="hljs${langClass}">${highlighted}</code></pre>`)
    })
  }

  registerTags(getOutputDir) {
    this.env.addExtension('GoogleFontsExtension', new GoogleFontsExtension())
    this.env.addExtension('ImageExtension', new ImageExtension(getOutputDir))
    this.env.addExtension('HighlightExtension', new HighlightExtension())
  }

  setGlobal(key, value) {
    this.env.addGlobal(key, value)
  }

  removeGlobal(key) {
    delete this.env.globals[key]
  }

  render(templateName, context) {
    return new Promise((resolve, reject) => {
      this.env.getTemplate(templateName).render(context, (error, result) => {
        if (!error) {
          resolve(result)
        } else {
          reject(error)
        }
      })
    })
  }

  renderString(source, context) {
    return new Promise((resolve, reject) => {
      this.env.renderString(source, context, (error, result) => {
        if (!error) {
          resolve(result)
        } else {
          reject(error)
        }
      })
    })
  }
}

// --- Nunjucks Extensions ---

export class GoogleFontsExtension {
  constructor() { this.tags = ['googleFonts'] }

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
        for (const w of wList) { expanded.push(`0,${w}`); expanded.push(`1,${w}`) }
        param = param.replace(/@.+$/, `@${expanded.join(';')}`)
      }
      return param
    })

    const url = `https://fonts.googleapis.com/css2?${families.join('&')}&display=${display}`
    return new nunjucks.runtime.SafeString(
      `<link rel="preconnect" href="https://fonts.googleapis.com">\n
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n
      <link href="${url}" rel="stylesheet">`
    )
  }
}

export class ImageExtension {
  constructor(getOutputDir) { this.tags = ['image']; this.getOutputDir = getOutputDir }

  parse(parser, nodes) {
    const tok = parser.nextToken()
    const args = parser.parseSignature(null, true)
    parser.advanceAfterBlockEnd(tok.value)
    return new nodes.CallExtension(this, 'run', args)
  }

  run(context, imagePath, kwargs) {
    const prefix = context.lookup('relativePathPrefix') || ''
    return new nunjucks.runtime.SafeString(buildImageTag(imagePath, prefix, kwargs, this.getOutputDir))
  }
}

export class HighlightExtension {
  constructor() { this.tags = ['highlight'] }

  parse(parser, nodes) {
    const tok = parser.nextToken()
    const args = parser.parseSignature(null, true)
    parser.advanceAfterBlockEnd(tok.value)
    const body = parser.parseUntilBlocks('endhighlight')
    parser.advanceAfterBlockEnd()
    return new nodes.CallExtension(this, 'run', args, [body])
  }

  run(context, lang, body) {
    const code = body()
    const highlighted = highlightCode(code, lang)
    const langClass = lang ? ` language-${lang}` : ''
    return new nunjucks.runtime.SafeString(
      `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`
    )
  }
}
