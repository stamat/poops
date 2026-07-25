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

const INTERNAL_FIELDS = new Set(['content', 'isIndex', 'layout', 'published', '_src'])

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

// Keyword extraction survives compiles: keyed by url, validated by comparing
// rendered content (V8 string equality is a memcmp — far cheaper than the
// regex passes in extractKeywords). Rebuilt per call, so deleted pages drop
// out. ponytail: retains each page's HTML across compiles; switch to content
// hashes if memory matters on very large sites.
let keywordCache = new Map()
let keywordCacheSig = ''

// Test hook: extraction always builds a fresh array, so reference identity
// across calls is proof of a memo hit
export function _getKeywordCache() {
  return keywordCache
}

export function generateSearchIndex(pageEntries, outputDir, config) {
  config = normalizeConfig(config)
  if (!config) return

  // Any option that changes extraction output invalidates the whole cache
  const sig = JSON.stringify([config.minWordLength, config.maxKeywords, config.stopWords])
  if (sig !== keywordCacheSig) {
    keywordCache = new Map()
    keywordCacheSig = sig
  }

  const stopWords = loadStopWords(config.stopWords)
  const nextCache = new Map()

  let entries = pageEntries
    .filter(e => !e.isIndex)
    .map(e => {
      const entry = {}
      for (const [key, value] of Object.entries(e)) {
        if (!INTERNAL_FIELDS.has(key)) entry[key] = value
      }
      if (!entry.keywords) {
        const content = e.content || ''
        const cached = keywordCache.get(e.url)
        entry.keywords = cached && cached.content === content
          ? cached.keywords
          : extractKeywords(content, { ...config, stopWords }).slice(0, config.maxKeywords)
        // Cached pre-ceiling: the frequency ceiling reassigns entry.keywords
        // to a new filtered array, so this reference stays unfiltered
        nextCache.set(e.url, { content, keywords: entry.keywords })
      }
      return entry
    })

  keywordCache = nextCache

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

// Generates an llms.txt (https://llmstxt.org): a markdown index of the site's
// pages that LLMs / generative engines ingest to understand the site (GEO).
// Structure: `# title`, a `> description` blockquote, then one `## section` per
// collection (uncollected pages go under a lead "Pages" section) with
// `- [title](absolute url): description` links. `title`/`description` are
// resolved from site data by the caller. Mirrors generateSitemap's page set —
// isIndex (collection landing/pagination) pages are skipped.
export function generateLlmsTxt(pageEntries, outputDir, siteUrl, config) {
  config = normalizeConfig(config)
  if (!config) return

  const baseUrl = siteUrl ? siteUrl.replace(/\/+$/, '') : ''
  const absUrl = (url) => baseUrl ? `${baseUrl}/${url}` : url

  let out = `# ${config.title || 'Site'}\n`
  if (config.description) out += `\n> ${config.description}\n`

  // Optional free-form body (llmstxt.org allows markdown between the blockquote
  // and the link sections). `intro` is a path to a markdown file authored for
  // LLM context — inserted verbatim. Avoid H2s in it; they'd read as sections.
  if (config.intro) {
    try {
      const body = fs.readFileSync(path.resolve(process.cwd(), config.intro), 'utf-8').trim()
      if (body) out += `\n${body}\n`
    } catch {
      log({ tag: 'indexer', warn: true, text: 'llms.txt intro file not found:', link: config.intro })
    }
  }

  // Group into two levels from the URL path, first-seen order preserved: first
  // folder = `## section`, second folder = `### subsection` nested under it,
  // root-level pages under the lead section. A collection's items already live
  // under `collectionName/…`, so the folder segments double as its grouping.
  const lead = config.sectionTitle || 'Pages'
  const sections = new Map() // name -> { direct: [entry], subs: Map<name, [entry]> }
  const sectionOf = (name) => {
    if (!sections.has(name)) sections.set(name, { direct: [], subs: new Map() })
    return sections.get(name)
  }

  for (const e of pageEntries) {
    if (e.isIndex) continue
    const slash = e.url.lastIndexOf('/')
    const segs = slash === -1 ? [] : e.url.slice(0, slash).split('/').filter(Boolean)
    if (segs.length === 0) {
      sectionOf(lead).direct.push(e)
    } else if (segs.length === 1) {
      sectionOf(humanizeSegment(segs[0])).direct.push(e)
    } else {
      const subs = sectionOf(humanizeSegment(segs[0])).subs
      const key = humanizeSegment(segs[1])
      if (!subs.has(key)) subs.set(key, [])
      subs.get(key).push(e)
    }
  }

  const linkLine = (e) => {
    const link = `[${e.title || e.url}](${absUrl(e.url)})`
    return e.description ? `- ${link}: ${e.description}\n` : `- ${link}\n`
  }

  // Collection buckets are chronological (newest first); other sections (docs)
  // keep their file/order sequence.
  const ordered = (entries) => {
    if (!entries.length || !entries.every(e => e.collection != null)) return entries
    return [...entries].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }

  for (const [name, group] of sections) {
    out += `\n## ${name}\n\n`
    for (const e of ordered(group.direct)) out += linkLine(e)
    for (const [subName, entries] of group.subs) {
      out += `\n### ${subName}\n\n`
      for (const e of ordered(entries)) out += linkLine(e)
    }
  }

  const outputPath = path.resolve(process.cwd(), outputDir, config.output)
  fs.writeFileSync(outputPath, out)
  log({ tag: 'indexer', text: 'Generated llms.txt:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
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
  generateLlmsTxt(pageEntries, outputDir, siteUrl, config.llms)
  generateNav(pageEntries, outputDir, config.nav)
}
