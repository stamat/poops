import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile, fileSize } from '../utils/helpers.js'
import { parseFrontMatter } from './helpers.js'
import { renderMarkdownCached } from './renderer.js'
import { humanize } from 'book-of-spells'
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

// Warned once per feature per process: llms is normalized twice (index + full),
// and a watch session would otherwise repeat the line on every rebuild.
const deprecationWarned = new Set()

function warnRenamedOutput(feature) {
  if (deprecationWarned.has(feature)) return
  deprecationWarned.add(feature)
  log({ tag: 'indexer', warn: true, text: `Deprecated: "${feature}.output" is now "${feature}.out" — still read, will stop working in 3.0.` })
}

// `out` is the output key everywhere else in a poops config, so it is the one
// here too. 1.x spelled it `output` in these sub-features; that still works,
// warns, and goes away in 3.0.
function normalizeConfig(config, feature) {
  if (!config) return null
  if (typeof config === 'string') return { out: config, ...DEFAULTS }
  const normalized = { ...DEFAULTS, ...config }
  if (normalized.out === undefined && normalized.output !== undefined) {
    warnRenamedOutput(feature)
    normalized.out = normalized.output
  }
  return normalized
}

// A page front-matter `robots: noindex` (or `none`) opts it out of the
// crawler/discovery artifacts — the sitemap and llms.txt.
function isNoindex(entry) {
  return entry.robots ? /\b(noindex|none)\b/i.test(String(entry.robots)) : false
}

// A markdown page's body carries two kinds of thing that are not prose, and the
// two artifacts built from the SOURCE rather than from the rendered html
// (llms-full.txt and a feed's article html) drop both:
//
// **Template syntax.** Markdown renders before the template engine, so a source
// read straight off disk still holds `{# … #}` comments, `{% … %}` tags and
// `{{ … }}` output. An LLM handed a corpus full of `{% set body %}` reads it as
// content. A `{% set x %}…{% endset %}` capture leaves behind the prose it
// wrapped, which is the whole point of dropping the tags rather than the block.
//
// **Assets.** An inline `<style>` or `<script>`, a `<script src>` and a `<link>`
// are the page's plumbing — a hundred lines of css teaches a reader nothing
// about the page, and a feed reader is going to strip the tags anyway.
//
// Protected, and returned untouched: fenced blocks and inline spans, because a
// sample documenting either of those is the page's content; and `{% raw %}`
// blocks, which give up their wrapper and keep their body — that body is
// exactly what the tag was protecting from the engine.
//
// Protection is parking, not walking the gaps between matches: a code span
// inside a `{# … #}` comment would otherwise split the comment in two and leave
// both halves unmatched. Parked first means a span inside a comment is carried
// off with the comment (machinery all the way down), while a tag inside a fence
// is never visible to the strip at all — which is the pair of answers wanted.
//
// ponytail: syntax, not semantics — the text inside an `{% if %}` that would
// not have rendered still contributes. Upgrade path if that bites: render the
// page through the engine and turn the html back into markdown.
const PROTECTED_RE = /\{%-?\s*raw\s*-?%\}([\s\S]*?)\{%-?\s*endraw\s*-?%\}|^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]{0,3}\2[^\n]*$|$(?![\s\S]))|`+[^`\n]*`+/gm
const TEMPLATE_RE = /\{#[\s\S]*?#\}|\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g
// `<script>` and `<style>` with their contents; then the void ones — a bare
// `<script src>`, a self-closing tag, a `<link>`.
const ASSET_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<script\b[^>]*\/?>|<link\b[^>]*>/gi
// NUL cannot occur in a markdown source, so a parked construct's placeholder
// cannot collide with the page's own text.
const PARKED_RE = /\0(\d+)\0/g

export function stripMachinery(source) {
  if (!source || !/[{<]/.test(source)) return source
  const parked = []
  const withoutContent = source.replace(PROTECTED_RE, (match, rawBody) =>
    `\0${parked.push(rawBody !== undefined ? rawBody : match) - 1}\0`
  )
  return withoutContent
    .replace(TEMPLATE_RE, '')
    .replace(ASSET_RE, '')
    // What a removal that was a whole line leaves behind. Trailing spaces on a
    // line that still has text are left alone — two of them are a hard break.
    .replace(/(?:\r?\n[ \t]*){3,}/g, '\n\n')
    .replace(PARKED_RE, (_, i) => parked[i])
}

// The markdown body of a page, as prose: front matter off, machinery out.
function pageSource(entry) {
  return stripMachinery(parseFrontMatter(entry._src).content)
}

export function extractKeywords(htmlContent, options = {}) {
  const { minWordLength = DEFAULTS.minWordLength, stopWords = new Set() } = options

  const text = htmlContent.replace(/<[^>]*>/g, ' ')
  const words = text
    .toLowerCase()
    // Keep any-script letters/numbers (\p{L}\p{N}) so non-English sites get
    // keywords too — an ASCII-only class stripped every accented/CJK char.
    .replace(/[^\p{L}\p{N}\-\s]/gu, ' ')
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
  config = normalizeConfig(config, 'markup.options.searchIndex')
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
  const outputPath = path.resolve(process.cwd(), outputDir, config.out)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2))
  log({ tag: 'indexer', text: 'Generated search index:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
}

export function generateSitemap(pageEntries, outputDir, siteUrl, config) {
  config = normalizeConfig(config, 'markup.options.sitemap')
  if (!config) return

  const baseUrl = siteUrl ? siteUrl.replace(/\/+$/, '') : ''

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  for (const entry of pageEntries) {
    if (isNoindex(entry)) continue
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
  const outputPath = path.resolve(process.cwd(), outputDir, config.out)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
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
  config = normalizeConfig(config, 'markup.options.llms')
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
    if (e.isIndex || isNoindex(e)) continue
    const slash = e.url.lastIndexOf('/')
    const segs = slash === -1 ? [] : e.url.slice(0, slash).split('/').filter(Boolean)
    if (segs.length === 0) {
      sectionOf(lead).direct.push(e)
    } else if (segs.length === 1) {
      sectionOf(humanize(segs[0])).direct.push(e)
    } else {
      const subs = sectionOf(humanize(segs[0])).subs
      const key = humanize(segs[1])
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

  const outputPath = path.resolve(process.cwd(), outputDir, config.out)
  fs.writeFileSync(outputPath, out)
  log({ tag: 'indexer', text: 'Generated llms.txt:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
}

// Generates llms-full.txt: every page's full content concatenated, the
// companion to llms.txt's link index (llmstxt.org). Enabled by `llms.full`
// (string path, or `true` → the index filename with a `-full` suffix). The content comes from each
// page's markdown SOURCE (entry._src), not entry.content — that's the rendered
// HTML page (layout + chrome). Only markdown sources qualify: an .njk/.liquid
// source is template code, not prose. The source's own template tags and asset
// tags go the same way, via stripMachinery.
export function generateLlmsFull(pageEntries, outputDir, siteUrl, config) {
  config = normalizeConfig(config, 'markup.options.llms')
  if (!config || !config.full) return
  // Default filename pairs with the index: llms.txt → llms-full.txt, ai.txt →
  // ai-full.txt (suffix the index's `output`, dir/ext preserved). A string
  // `full` overrides the path outright.
  let output = config.full
  if (typeof output !== 'string') {
    const p = path.parse(config.out || 'llms.txt')
    output = path.join(p.dir, `${p.name}-full${p.ext}`)
  }

  const baseUrl = siteUrl ? siteUrl.replace(/\/+$/, '') : ''
  const absUrl = (url) => baseUrl ? `${baseUrl}/${url}` : url
  const isMarkdown = (src) => /\.(md|markdown)$/i.test(src || '')

  const blocks = []
  for (const e of pageEntries) {
    if (e.isIndex || isNoindex(e) || !isMarkdown(e._src)) continue
    const body = pageSource(e).trim()
    if (!body) continue
    const url = `URL: ${absUrl(e.url)}`
    // If the body already opens with its own ATX H1, reuse it as the block
    // heading and slot the URL beneath — otherwise the wrapper `# title` plus
    // the body's H1 would emit two H1s per block (often exact duplicates).
    const h1 = body.match(/^# .*(?:\r?\n|$)/)
    blocks.push(h1
      ? `${h1[0].trim()}\n${url}\n\n${body.slice(h1[0].length).trimStart()}`
      : `# ${e.title || e.url}\n${url}\n\n${body}`)
  }
  if (!blocks.length) return

  // Corpus header: names the file and its purpose so a whole-file ingest opens
  // with context instead of the first page's H1. Reuses the index title/desc.
  const name = config.title || 'this site'
  let head = `# Full Documentation Archive for ${name}\n`
  head += `\nThis file contains the complete Markdown documentation for ${name}.`
  if (config.description) head += `\n\n> ${config.description}`
  // Optional author-written preamble after the header — the full-file counterpart
  // to `intro` for the index. Inserted verbatim; a missing file warns and skips.
  if (config.fullIntro) {
    try {
      const body = fs.readFileSync(path.resolve(process.cwd(), config.fullIntro), 'utf-8').trim()
      if (body) head += `\n\n${body}`
    } catch {
      log({ tag: 'indexer', warn: true, text: 'llms-full intro file not found:', link: config.fullIntro })
    }
  }
  blocks.unshift(head)

  const outputPath = path.resolve(process.cwd(), outputDir, output)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, blocks.join('\n\n---\n\n') + '\n')
  log({ tag: 'indexer', text: 'Generated llms-full.txt:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
}

// Generates a robots.txt. Defaults to allow-all with a `Sitemap:` line pointing
// at the generated sitemap (absolute, needs `site.url`). The object form takes
// `userAgent`, `allow`/`disallow` (string or array of paths) and `sitemap`
// (an explicit URL, or `false` to omit the line). `sitemapOutput` is the
// sitemap's filename, threaded in by generateIndexFiles.
// ponytail: single user-agent group; add per-agent groups if a real need shows up.
export function generateRobotsTxt(outputDir, siteUrl, config, sitemapOutput) {
  config = normalizeConfig(config, 'markup.options.robots')
  if (!config) return

  const arr = (v) => v == null ? [] : (Array.isArray(v) ? v : [v])
  const allow = arr(config.allow)
  const disallow = arr(config.disallow)

  const lines = [`User-agent: ${config.userAgent || '*'}`]
  for (const p of allow) lines.push(`Allow: ${p}`)
  for (const p of disallow) lines.push(`Disallow: ${p}`)
  // Empty `Disallow:` is the canonical "allow everything" when nothing is set.
  if (allow.length === 0 && disallow.length === 0) lines.push('Disallow:')

  let sitemapUrl = null
  if (config.sitemap === false) {
    sitemapUrl = null
  } else if (typeof config.sitemap === 'string') {
    sitemapUrl = config.sitemap
  } else if (sitemapOutput && siteUrl) {
    sitemapUrl = `${siteUrl.replace(/\/+$/, '')}/${sitemapOutput}`
  }
  if (sitemapUrl) lines.push('', `Sitemap: ${sitemapUrl}`)

  const outputPath = path.resolve(process.cwd(), outputDir, config.out)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, lines.join('\n') + '\n')
  log({ tag: 'indexer', text: 'Generated robots.txt:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
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
        result.push({ ...e, title: humanize(e.title) })
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

function navChild(cursor, key, segment) {
  if (!cursor.children.has(key)) {
    cursor.children.set(key, { segment, children: new Map() })
  }
  return cursor.children.get(key)
}

// `group` (front matter `navGroup`) files the page under a virtual node beside
// its siblings, so a sidebar can group pages the urls don't group. The node is
// keyed NUL-prefixed: a path segment can never contain NUL, so a directory
// named like the group can't be merged into it.
function insertNavNode(root, entry, group) {
  const segments = entry.url.split('/')
  const leaf = segments.pop()
  let cursor = root
  for (const seg of segments) cursor = navChild(cursor, seg, seg)
  if (group) {
    cursor = navChild(cursor, '\0' + group, group)
    cursor.title = group
  }
  cursor = navChild(cursor, leaf, leaf)
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

  const out = { title: node.title != null ? node.title : humanize(node.segment) }
  if (node.url != null) out.url = node.url

  let order = node.order
  if (order == null && !node.hasPage && children.length) order = children[0].order
  if (order != null) out.order = order

  if (children.length) out.children = children
  return out
}

// Every url that is also a directory in the tree. A page sitting on one is a
// section's index page: moving it into a group would leave its subpages behind
// on the ungrouped path and split the section in two, so navGroup is refused
// there rather than quietly producing two sections with the same name.
function navSectionUrls(entries) {
  const sections = new Set()
  for (const entry of entries) {
    const segments = entry.url.split('/')
    segments.pop()
    for (let i = 1; i <= segments.length; i++) sections.add(segments.slice(0, i).join('/'))
  }
  return sections
}

function resolveNavGroup(entry, sections) {
  if (entry.navGroup == null) return null
  const group = typeof entry.navGroup === 'string' ? entry.navGroup.trim() : ''
  if (!group) {
    log({ tag: 'indexer', warn: true, text: 'navGroup must be a non-empty string, ignored on:', link: entry.url || '/' })
    return null
  }
  if (entry.url === '' || sections.has(entry.url)) {
    log({ tag: 'indexer', warn: true, text: 'navGroup cannot group an index page, ignored on:', link: entry.url || '/' })
    return null
  }
  return group
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
  const sections = navSectionUrls(entries)
  let homeEntry = null
  for (const entry of entries) {
    const group = resolveNavGroup(entry, sections)
    // root index page (url '') can't be segment-split — it would corrupt the
    // tree; handle it as a top-level leaf instead
    if (entry.url === '') { homeEntry = entry; continue }
    insertNavNode(tree, entry, group)
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
  config = normalizeConfig(config, 'markup.options.nav')
  if (!config) return

  const tree = buildNavTree(pageEntries, config)

  // resolve, not join: outputDir may be absolute (join would mangle it,
  // e.g. cross-drive temp dirs on Windows)
  const outputPath = path.resolve(process.cwd(), outputDir, config.out)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2))
  log({ tag: 'indexer', text: 'Generated nav:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
}

// RFC-822 date for RSS pubDate/lastBuildDate (toUTCString is RFC-822 compliant).
function rssDate(d) {
  const date = new Date(d)
  return isNaN(date) ? '' : date.toUTCString()
}

// ISO-8601 (RFC-3339) date for Atom updated timestamps.
function isoDate(d) {
  const date = new Date(d)
  return isNaN(date) ? new Date().toISOString() : date.toISOString()
}

function feedAuthorName(author) {
  if (!author) return ''
  return String(author.name || author)
}

// Normalizes the `feed` option into concrete per-collection specs. Accepts:
//   true | "feed.xml"           → RSS for every collection
//   { out, type, limit, … }     → those options for every collection
//   { collection, … }           → one named collection
//   [ {…}, {…} ]                → an explicit list
// `out` containing a slash is a full path under the output dir; a bare
// filename is placed in the collection's own folder (default "feed.xml").
function resolveFeedSpecs(config, collectionNames, site) {
  if (!config) return []
  const raw = Array.isArray(config) ? config : [config]
  const specs = []
  for (let item of raw) {
    if (item === true) item = {}
    else if (typeof item === 'string') item = { out: item }
    if (!item || typeof item !== 'object') continue

    if (item.out === undefined && item.output !== undefined) {
      warnRenamedOutput('markup.options.feed')
      item = { ...item, out: item.output }
    }

    const targets = item.collection ? [item.collection] : collectionNames
    for (const name of targets) {
      const outName = item.out || 'feed.xml'
      specs.push({
        collection: name,
        out: outName.includes('/') ? outName : `${name}/${outName}`,
        type: item.type === 'atom' ? 'atom' : 'rss',
        limit: Number(item.limit) > 0 ? Number(item.limit) : 20,
        title: item.title || (site.title ? `${humanize(name)} | ${site.title}` : humanize(name)),
        description: item.description || site.description || '',
        author: feedAuthorName(item.author || site.author),
        lang: item.lang || site.lang || '',
        content: item.content === true // full article HTML in <content:encoded>
      })
    }
  }
  return specs
}

// Article-body HTML for a feed item's <content:encoded> / Atom <content>. Renders
// the page's markdown SOURCE (entry._src) with the shared marked instance — the
// same extensions the site uses — so it's clean article HTML, not entry.content
// (the whole rendered page, layout + chrome). Markdown sources only, and the
// same stripMachinery pass llms-full makes — a `{% set %}` reaching a feed
// reader is the same leak, and its `<script>` would be stripped there anyway.
// That pass changes the string the render cache is keyed on, so this one misses
// the compile's entry and renders once per build.
// Returns '' when there's no clean body to emit.
function feedContentHtml(e) {
  if (!e._src || !/\.(md|markdown)$/i.test(e._src)) return ''
  return renderMarkdownCached(e._src, pageSource(e)).trim()
}

// `]]>` would close the CDATA section early; split it so the payload survives.
function cdata(html) {
  return `<![CDATA[${html.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function buildRssFeed(spec, items, { selfUrl, channelLink, abs }) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"'
  xml += spec.content ? ' xmlns:content="http://purl.org/rss/1.0/modules/content/">\n' : '>\n'
  xml += '<channel>\n'
  xml += `  <title>${escapeXml(spec.title)}</title>\n`
  xml += `  <link>${escapeXml(channelLink)}</link>\n`
  if (spec.description) xml += `  <description>${escapeXml(spec.description)}</description>\n`
  if (selfUrl) xml += `  <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>\n`
  if (spec.lang) xml += `  <language>${escapeXml(spec.lang)}</language>\n`
  if (items[0] && items[0].date) xml += `  <lastBuildDate>${rssDate(items[0].date)}</lastBuildDate>\n`
  for (const e of items) {
    const link = abs(e.url)
    const desc = e.description || e.excerpt
    xml += '  <item>\n'
    xml += `    <title>${escapeXml(e.title || e.url)}</title>\n`
    xml += `    <link>${escapeXml(link)}</link>\n`
    xml += `    <guid isPermaLink="true">${escapeXml(link)}</guid>\n`
    if (desc) xml += `    <description>${escapeXml(desc)}</description>\n`
    if (e.date) xml += `    <pubDate>${rssDate(e.date)}</pubDate>\n`
    if (spec.content) {
      const html = feedContentHtml(e)
      if (html) xml += `    <content:encoded>${cdata(html)}</content:encoded>\n`
    }
    xml += '  </item>\n'
  }
  xml += '</channel>\n</rss>\n'
  return xml
}

function buildAtomFeed(spec, items, { selfUrl, channelLink, abs }) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<feed xmlns="http://www.w3.org/2005/Atom">\n'
  xml += `  <title>${escapeXml(spec.title)}</title>\n`
  if (spec.description) xml += `  <subtitle>${escapeXml(spec.description)}</subtitle>\n`
  xml += `  <id>${escapeXml(selfUrl || channelLink)}</id>\n`
  xml += `  <link href="${escapeXml(channelLink)}"/>\n`
  if (selfUrl) xml += `  <link href="${escapeXml(selfUrl)}" rel="self" type="application/atom+xml"/>\n`
  xml += `  <updated>${isoDate(items[0] && items[0].date)}</updated>\n`
  if (spec.author) xml += `  <author><name>${escapeXml(spec.author)}</name></author>\n`
  for (const e of items) {
    const link = abs(e.url)
    const desc = e.description || e.excerpt
    const author = feedAuthorName(e.author)
    xml += '  <entry>\n'
    xml += `    <title>${escapeXml(e.title || e.url)}</title>\n`
    xml += `    <link href="${escapeXml(link)}"/>\n`
    xml += `    <id>${escapeXml(link)}</id>\n`
    xml += `    <updated>${isoDate(e.date)}</updated>\n`
    if (desc) xml += `    <summary>${escapeXml(desc)}</summary>\n`
    if (author) xml += `    <author><name>${escapeXml(author)}</name></author>\n`
    if (spec.content) {
      const html = feedContentHtml(e)
      if (html) xml += `    <content type="html">${cdata(html)}</content>\n`
    }
    xml += '  </entry>\n'
  }
  xml += '</feed>\n'
  return xml
}

// Generates RSS/Atom feeds from collections — one file per resolved spec, its
// items the collection's posts newest-first (by date), capped at `limit`.
// Items carry description/excerpt by default; `content: true` on a spec adds
// full article HTML (<content:encoded> / Atom <content>) via feedContentHtml,
// which renders the markdown source rather than reusing the whole-page HTML.
export function generateFeeds(pageEntries, outputDir, siteUrl, config, site = {}) {
  if (!config) return

  // Distinct collections present, first-seen order.
  const collectionNames = []
  const byCollection = new Map()
  for (const e of pageEntries) {
    if (e.isIndex || e.collection == null) continue
    if (!byCollection.has(e.collection)) {
      byCollection.set(e.collection, [])
      collectionNames.push(e.collection)
    }
    byCollection.get(e.collection).push(e)
  }

  const baseUrl = siteUrl ? siteUrl.replace(/\/+$/, '') : ''
  const abs = (u) => {
    const rel = String(u == null ? '' : u).replace(/^\/+/, '')
    if (/^https?:\/\//i.test(u)) return u
    return baseUrl ? (rel ? `${baseUrl}/${rel}` : baseUrl) : `/${rel}`
  }

  for (const spec of resolveFeedSpecs(config, collectionNames, site)) {
    const items = (byCollection.get(spec.collection) || [])
      .filter(e => !isNoindex(e))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, spec.limit)

    const ctx = { selfUrl: abs(spec.out), channelLink: abs(spec.collection), abs }
    const xml = spec.type === 'atom' ? buildAtomFeed(spec, items, ctx) : buildRssFeed(spec, items, ctx)

    const outputPath = path.resolve(process.cwd(), outputDir, spec.out)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, xml)
    log({ tag: 'indexer', text: 'Generated feed:', link: path.relative(process.cwd(), outputPath), size: fileSize(outputPath) })
  }
}

export function generateIndexFiles(pageEntries, outputDir, siteUrl, config) {
  generateSearchIndex(pageEntries, outputDir, config.searchIndex)
  generateSitemap(pageEntries, outputDir, siteUrl, config.sitemap)
  generateLlmsTxt(pageEntries, outputDir, siteUrl, config.llms)
  generateLlmsFull(pageEntries, outputDir, siteUrl, config.llms)
  const sitemapOutput = config.sitemap
    ? (typeof config.sitemap === 'string' ? config.sitemap : (config.sitemap.out ?? config.sitemap.output))
    : null
  generateRobotsTxt(outputDir, siteUrl, config.robots, sitemapOutput)
  generateNav(pageEntries, outputDir, config.nav)
  generateFeeds(pageEntries, outputDir, siteUrl, config.feed, config.site)
}
