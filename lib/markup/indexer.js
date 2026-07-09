import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile, fileSize } from '../utils/helpers.js'
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

  // resolve, not join: outputDir may be absolute (join would mangle it,
  // e.g. cross-drive temp dirs on Windows)
  const outputPath = path.resolve(process.cwd(), outputDir, config.output)
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2))
  log({ tag: 'indexer', text: 'Generated search index:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
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

  // resolve, not join: outputDir may be absolute (join would mangle it,
  // e.g. cross-drive temp dirs on Windows)
  const outputPath = path.resolve(process.cwd(), outputDir, config.output)
  fs.writeFileSync(outputPath, xml)
  log({ tag: 'indexer', text: 'Generated sitemap:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
}

function humanizeSegment(seg) {
  return seg
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

function navNodeTitle(entry) {
  return entry.navTitle || entry.title
}

// Applies the `collections` option (true | false | ["name"] | "index") on top
// of the base exclusions (nav:false, and isIndex pages which are collection
// landing/pagination). "index" is the exception that re-admits each
// collection's first landing page as a single leaf.
function navFilterEntries(pageEntries, collectionsOpt) {
  const mode = collectionsOpt === undefined ? true : collectionsOpt
  const allowlist = Array.isArray(mode) ? new Set(mode) : null
  const result = []

  for (const e of pageEntries) {
    if (e.nav === false) continue

    if (e.isIndex) {
      // collection landing (url === name, no slash) kept only in "index" mode;
      // pagination pages (url has a slash) always dropped. Landing titles are
      // the raw collection name ("blog"), so humanize for display.
      if (mode === 'index' && !e.url.includes('/')) {
        result.push({ ...e, title: humanizeSegment(e.title) })
      }
      continue
    }

    if (e.collection != null) {
      if (mode === false || mode === 'index') continue
      if (allowlist && !allowlist.has(e.collection)) continue
    }
    result.push(e)
  }

  return result
}

function insertNavNode(root, entry) {
  let cursor = root
  for (const seg of entry.url.split('/')) {
    if (!cursor.children.has(seg)) {
      cursor.children.set(seg, { segment: seg, children: new Map() })
    }
    cursor = cursor.children.get(seg)
  }
  cursor.hasPage = true
  cursor.url = entry.url
  cursor.title = navNodeTitle(entry)
  if (entry.order != null) cursor.order = entry.order
}

function getNavNode(root, urlPath) {
  let cursor = root
  for (const seg of urlPath.split('/')) {
    cursor = cursor.children.get(seg)
    if (!cursor) return null
  }
  return cursor
}

function sortNavSiblings(nodes) {
  nodes.sort((a, b) => {
    const oa = a.order != null ? a.order : Infinity
    const ob = b.order != null ? b.order : Infinity
    if (oa !== ob) return oa - ob
    return String(a.title).localeCompare(String(b.title))
  })
}

// Post-order: children are serialized (and thus order-resolved) before the
// parent, so a virtual parent can borrow its first child's order.
function serializeNavNode(node) {
  const children = [...node.children.values()].map(serializeNavNode)
  sortNavSiblings(children)

  const out = { title: node.title != null ? node.title : humanizeSegment(node.segment) }
  if (node.url != null) out.url = node.url

  let order = node.order
  if (order == null && !node.hasPage && children.length) order = children[0].order
  if (order != null) out.order = order

  if (children.length) out.children = children
  return out
}

export function buildNavTree(pageEntries, config = {}) {
  const { collections, home, root } = config
  let entries = navFilterEntries(pageEntries, collections)

  if (root != null) {
    const prefix = root + '/'
    entries = entries.filter(e => e.url === root || e.url.startsWith(prefix))
  } else if (home === false) {
    entries = entries.filter(e => e.url !== '')
  }

  const tree = { children: new Map() }
  let homeEntry = null
  for (const entry of entries) {
    // root index page (url '') can't be segment-split — it would corrupt the
    // tree; handle it as a top-level leaf instead
    if (entry.url === '') { homeEntry = entry; continue }
    insertNavNode(tree, entry)
  }

  // root scoping: emit the section's children unwrapped to the top level, with
  // the section's own index page (if any) pinned first as the overview link
  if (root != null) {
    const rootNode = getNavNode(tree, root)
    if (!rootNode) return []
    const top = [...rootNode.children.values()].map(serializeNavNode)
    sortNavSiblings(top)
    if (rootNode.hasPage) {
      const overview = { title: rootNode.title, url: rootNode.url }
      if (rootNode.order != null) overview.order = rootNode.order
      top.unshift(overview)
    }
    return top
  }

  const top = [...tree.children.values()].map(serializeNavNode)
  if (homeEntry) {
    const node = { title: navNodeTitle(homeEntry), url: '' }
    if (homeEntry.order != null) node.order = homeEntry.order
    top.push(node)
  }
  sortNavSiblings(top)
  return top
}

export function generateNav(pageEntries, outputDir, config) {
  config = normalizeConfig(config)
  if (!config) return

  const tree = buildNavTree(pageEntries, config)

  // resolve, not join: outputDir may be absolute (join would mangle it,
  // e.g. cross-drive temp dirs on Windows)
  const outputPath = path.resolve(process.cwd(), outputDir, config.output)
  fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2))
  log({ tag: 'indexer', text: 'Generated nav:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
}

export function generateIndexFiles(pageEntries, outputDir, siteUrl, config) {
  generateSearchIndex(pageEntries, outputDir, config.searchIndex)
  generateSitemap(pageEntries, outputDir, siteUrl, config.sitemap)
  generateNav(pageEntries, outputDir, config.nav)
}
