import fs from 'node:fs'
import { parse as parseMarkdown } from 'marked'
import dayjs from 'dayjs'
import path from 'node:path'
import nunjucks from 'nunjucks'
import { slugify } from 'book-of-spells'
import { discoverImageVariants } from '../utils/helpers.js'

export { slugify }

export function jsonify(obj) {
  return JSON.stringify(obj)
}

export function markdown(str) {
  return parseMarkdown(str)
}

export function dateFilter(str, template, defaultFormat) {
  if (!template) template = defaultFormat
  if (!template) return str
  const date = !str || str.trim() === '' ? new Date() : new Date(str)
  return dayjs(date).format(template)
}

export function concat(arr, value) {
  if (!Array.isArray(arr)) return [value]
  return arr.concat(value)
}

export function push(arr, value) {
  if (!Array.isArray(arr)) return [value]
  arr.push(value)
  return arr
}

export function svg(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(fullPath)) return ''
  const content = fs.readFileSync(fullPath, 'utf-8').trim()
  if (!/^(<\?xml[^?]*\?>\s*)?<svg[\s>]/i.test(content)) return ''
  return content
}

export function srcsetFilter(imagePath, markupOut) {
  const outputDir = path.join(process.cwd(), markupOut)
  const { variants } = discoverImageVariants(imagePath, outputDir)
  if (variants.length === 0) return ''
  return variants.map(v => `${v.path} ${v.width}w`).join(', ')
}

export function registerFilters(env, { timeDateFormat, markupOut }) {
  env.addFilter('slugify', slugify)
  env.addFilter('jsonify', jsonify)
  env.addFilter('markdown', markdown)
  env.addFilter('concat', concat)
  env.addFilter('push', push)
  env.addFilter('svg', (filePath) => new nunjucks.runtime.SafeString(svg(filePath)))
  env.addFilter('date', (str, template) => dateFilter(str, template, timeDateFormat))
  env.addFilter('srcset', (imagePath) => srcsetFilter(imagePath, markupOut))
}
