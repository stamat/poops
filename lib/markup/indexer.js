import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile } from '../utils/helpers.js'
import log from '../utils/log.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_STOP_WORDS_PATH = path.join(__dirname, 'stop-words-en.json')

function loadStopWords(stopWordsOption) {
  if (stopWordsOption === false) return new Set()
  if (Array.isArray(stopWordsOption)) return new Set(stopWordsOption)

  const filePath = typeof stopWordsOption === 'string'
    ? path.resolve(process.cwd(), stopWordsOption)
    : DEFAULT_STOP_WORDS_PATH

  try {
    return new Set(readJsonFile(filePath))
  } catch (err) {
    log({ tag: 'indexer', error: true, text: 'Failed loading stop words:', link: filePath })
    return new Set()
  }
}

const DEFAULTS = {
  minWordLength: 3,
  maxKeywords: 20,
  globalFrequencyCeiling: 0.8
}

const INTERNAL_FIELDS = new Set(['content', 'isIndex', 'layout', 'published'])

function normalizeConfig(config) {
  if (!config) return null
  if (typeof config === 'string') return { output: config, ...DEFAULTS }
  return { ...DEFAULTS, ...config }
}

export function extractKeywords(htmlContent, options = {}) {
  const { minWordLength = DEFAULTS.minWordLength, stopWords = new Set() } = options

  const text = htmlContent.replace(/<[^>]*>/g, ' ')
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\-\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= minWordLength && !stopWords.has(w) && !/^\d+$/.test(w))

  const freq = new Map()
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
}

function applyGlobalFrequencyCeiling(entries, ceiling) {
  const totalPages = entries.length
  if (totalPages === 0) return entries

  const maxAppearances = Math.max(1, Math.floor(totalPages * ceiling))

  const wordPageCount = new Map()
  for (const entry of entries) {
    const seen = new Set(entry.keywords)
    for (const word of seen) {
      wordPageCount.set(word, (wordPageCount.get(word) || 0) + 1)
    }
  }

  const tooCommon = new Set()
  for (const [word, count] of wordPageCount) {
    if (count > maxAppearances) tooCommon.add(word)
  }

  if (tooCommon.size === 0) return entries

  for (const entry of entries) {
    entry.keywords = entry.keywords.filter(w => !tooCommon.has(w))
  }

  return entries
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateSearchIndex(pageEntries, outputDir, config) {
  config = normalizeConfig(config)
  if (!config) return

  const stopWords = loadStopWords(config.stopWords)

  let entries = pageEntries
    .filter(e => !e.isIndex)
    .map(e => {
      const entry = {}
      for (const [key, value] of Object.entries(e)) {
        if (!INTERNAL_FIELDS.has(key)) entry[key] = value
      }
      if (!entry.keywords) {
        entry.keywords = extractKeywords(e.content || '', { ...config, stopWords })
          .slice(0, config.maxKeywords)
      }
      return entry
    })

  entries = applyGlobalFrequencyCeiling(entries, config.globalFrequencyCeiling)

  const outputPath = path.join(process.cwd(), outputDir, config.output)
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2))
  log({ tag: 'indexer', text: 'Generated search index:', link: path.relative(process.cwd(), outputPath) })
}

export function generateSitemap(pageEntries, outputDir, siteUrl, config) {
  config = normalizeConfig(config)
  if (!config) return

  const baseUrl = siteUrl ? siteUrl.replace(/\/+$/, '') : ''

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  for (const entry of pageEntries) {
    const loc = baseUrl ? `${baseUrl}/${entry.url}` : entry.url
    xml += '  <url>\n'
    xml += `    <loc>${escapeXml(loc)}</loc>\n`
    if (entry.date) {
      const dateStr = new Date(entry.date).toISOString().slice(0, 10)
      xml += `    <lastmod>${dateStr}</lastmod>\n`
    }
    xml += '  </url>\n'
  }

  xml += '</urlset>\n'

  const outputPath = path.join(process.cwd(), outputDir, config.output)
  fs.writeFileSync(outputPath, xml)
  log({ tag: 'indexer', text: 'Generated sitemap:', link: path.relative(process.cwd(), outputPath) })
}

export function generateIndexFiles(pageEntries, outputDir, siteUrl, config) {
  generateSearchIndex(pageEntries, outputDir, config.searchIndex)
  generateSitemap(pageEntries, outputDir, siteUrl, config.sitemap)
}
