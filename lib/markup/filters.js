import { parse as parseMarkdown } from 'marked'
import moment from 'moment'
import path from 'node:path'
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
  return moment(date).format(template)
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
  env.addFilter('date', (str, template) => dateFilter(str, template, timeDateFormat))
  env.addFilter('srcset', (imagePath) => srcsetFilter(imagePath, markupOut))
}
