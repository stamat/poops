import fs from 'node:fs'
import dayjs from 'dayjs'
import path from 'node:path'
import { Marked } from 'marked'
import { slugify } from 'book-of-spells'
import { discoverImageVariants } from '../utils/helpers.js'
import { highlightRenderer, highlightCode } from '../markup/highlight.js'

const marked = new Marked({ renderer: highlightRenderer })

export function registerFilters(engine, { timeDateFormat, markupOut }) {
  engine.registerFilter('slugify', (str) => slugify(str))

  engine.registerFilter('jsonify', (obj) => JSON.stringify(obj))

  engine.registerFilter('markdown', (str) => marked.parse(str))

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
    const outputDir = path.join(process.cwd(), markupOut)
    const { variants } = discoverImageVariants(imagePath, outputDir)
    if (variants.length === 0) return ''
    return variants.map(v => `${v.path} ${v.width}w`).join(', ')
  })

  engine.registerFilter('highlight', (code, lang) => {
    const highlighted = highlightCode(code, lang)
    const langClass = lang ? ` language-${lang}` : ''
    return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`
  })
}
