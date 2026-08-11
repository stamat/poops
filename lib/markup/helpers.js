import fs from 'node:fs'
import path from 'node:path'
import yaml from 'yaml'
import { humanize, slugify } from 'book-of-spells'
import { toPosix } from '../utils/helpers.js'
import { getImageEntry } from './image-cache.js'
import { stampUpdatedDate } from './update-index.js'

const frontMatterCache = new Map()

// Front matter is handed out as a copy — callers stamp url, collection and
// wordcount onto it — so the updated date lands on the copy too, never on the
// cached original. Every page, collection item and nav entry comes through
// here, which is why it is the one place the date is applied.
function withUpdatedDate(filePath, value, stat) {
  const frontMatter = { ...value.frontMatter }
  stampUpdatedDate(filePath, frontMatter, value.content, stat.mtimeMs)
  return { frontMatter, content: value.content }
}

export function parseFrontMatter(filePath) {
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (e) {
    throw new Error(`Error stating file at ${filePath}: ${e.message}`)
  }

  const cached = frontMatterCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return withUpdatedDate(filePath, cached.value, stat)
  }

  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    throw new Error(`Error reading file at ${filePath}: ${e.message}`)
  }

  if (!content) {
    throw new Error(`File at ${filePath} is empty`)
  }

  const frontMatterRegex = /^\s*---\s*[\r\n]+([\s\S]*?)\s*---\s*[\r\n]+/
  const match = content.match(frontMatterRegex)

  if (!match) {
    const value = { frontMatter: {}, content }
    frontMatterCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, value })
    return withUpdatedDate(filePath, value, stat)
  }

  let frontMatter = {}
  try {
    frontMatter = yaml.parse(match[1])
  } catch (e) {
    throw new Error(`Error parsing front matter in file at ${filePath}: ${e.message}`)
  }

  const contentWithoutFrontMatter = content.slice(match[0].length)
  const value = { frontMatter, content: contentWithoutFrontMatter }
  frontMatterCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, value })
  return withUpdatedDate(filePath, value, stat)
}

export function clearFrontMatterCache(filePath) {
  if (!filePath) {
    frontMatterCache.clear()
    return
  }
  frontMatterCache.delete(filePath)
}

export function wordcount(text) {
  if (!text) return 0
  // eslint-disable-next-line no-useless-escape
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/[#*_`~\[\]()>|{}\\-]/g, ' ')
  const words = stripped.match(/\S+/g)
  return words ? words.length : 0
}

const TEMPLATE_TAG_RE = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/

// True while a string still carries an unresolved Nunjucks/Liquid tag. Anything
// derived before the template pass — an excerpt, a heading slug — can contain
// one, and shipping it is a visible lie: an og:description reading
// "site.description" instead of the description.
export function hasTemplateTags(str) {
  return TEMPLATE_TAG_RE.test(String(str || ''))
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }

// Undoes the entity encoding marked applies to prose, for text read back out of
// rendered HTML. One pass, so a literal `&amp;lt;` decodes to `&lt;` and stops
// there instead of turning into `<`.
function decodeEntities(str) {
  return str.replace(/&(amp|lt|gt|quot|#39);/g, (whole, name) => NAMED_ENTITIES[name])
}

// Visible text of an HTML fragment: tags out, entities back to characters,
// whitespace collapsed.
export function plainText(html) {
  if (!html) return ''
  return decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// First prose paragraph of rendered HTML as plain text, for a meta-description
// fallback when front matter has none. Reading <p> is what skips headings,
// comments, code fences and tables — no skip list to keep in step — then it caps
// at ~160 chars (search-snippet size) on a word boundary.
//
// Empty when that paragraph still holds a template tag, or when one stands ahead
// of it — an unresolved `{% include %}` hides however many paragraphs the
// partial opens with, so the first one visible here is not the page's first.
// Either way it is the caller's cue to resolve the body and ask again. Slicing
// the tag's source out was the bug this replaced: `{{ site.description }}`
// became the string "site.description", which then beat the site.description it
// was masking.
export function excerpt(html, max = 160) {
  if (!html) return ''
  const str = String(html)
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
  let match
  while ((match = re.exec(str)) !== null) {
    const text = plainText(match[1])
    if (!text) continue
    if (hasTemplateTags(text) || hasTemplateTags(str.slice(0, match.index))) return ''
    if (text.length <= max) return text
    return text.slice(0, max).replace(/\s+\S*$/, '').trim() + '…'
  }
  return ''
}

// A heading and its permalink anchor. The anchor is empty on purpose — themes
// reveal a "#" via `.heading-anchor::before`, so a site with no such CSS renders
// an invisible anchor instead of a stray "#".
//
// `aria-hidden` and `tabindex="-1"` travel together or not at all. Hidden and
// still focusable is a link in the tab order that no screen reader can name — a
// stop on nothing, and a WCAG 4.1.2 failure. It also carried an `aria-label`,
// which `aria-hidden` had already made unreadable; the heading beside it is the
// name of the place, so the anchor is decoration and is now marked as decoration
// the whole way down. Mouse users lose nothing: the "#" still clicks.
export function headingHtml(depth, inner, id) {
  if (!id) return `<h${depth}>${inner}</h${depth}>`
  return `<h${depth} id="${id}">${inner}<a class="heading-anchor" href="#${id}" tabindex="-1" aria-hidden="true"></a></h${depth}>`
}

// Markdown runs before the template engine, so a heading written as
// `# {{ site.title }}` has no text to slug yet — slugging its source gives the
// id "site-title", and swapping which variable feeds the heading silently
// remints every bookmarked anchor. The renderer marks those headings with this
// attribute and leaves them idless; applyHeadingSlugs finishes the job once the
// rendered text exists.
export const PENDING_HEADING_ATTR = 'data-poops-heading'

const PENDING_HEADING_RE = new RegExp(`<h([1-6]) ${PENDING_HEADING_ATTR}>([\\s\\S]*?)</h\\1>`, 'g')

// Assigns ids and permalink anchors to the headings the markdown renderer left
// pending. Runs on rendered page output, and on the TOC filter's input so both
// slug the same text. A tag still present here means the string never reached
// the engine (feed bodies render markdown straight from source) — it is dropped
// rather than slugged, leaving a plain heading instead of a made-up anchor.
export function applyHeadingSlugs(html) {
  const str = String(html || '')
  if (!str.includes(PENDING_HEADING_ATTR)) return str
  return str.replace(PENDING_HEADING_RE, (whole, depth, inner) =>
    headingHtml(depth, inner, slugify(plainText(inner).replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, ' ').trim()))
  )
}

// marked HTML-encodes quotes/brackets in template tags it treats as prose,
// breaking string args like groupby("date"). Decode entities inside {{ }} / {% %}
// after markdown, before the template engine parses. Decode &amp; last so
// &amp;lt; doesn't double-decode into <.
export function decodeTemplateEntities(html) {
  return html.replace(/(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\})/g, (tag) =>
    tag
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  )
}

// Builds a flat H2/H3 table of contents from rendered HTML, reading the ids
// the markdown heading renderer emits so TOC links always match the anchors.
// H3s carry a `toc-h3` class for indentation — no nested <ul>, so leading H3s
// (no parent H2) stay valid. Heading text is already entity-encoded by marked,
// so it's spliced in as-is (re-escaping would double-encode &amp;).
// `.sr-only` headings are visually hidden, so they're skipped — a visible TOC
// linking to invisible content is confusing.
export function renderToc(html) {
  if (!html) return ''
  // The filter runs on rendered page HTML, where a pending heading's text is
  // finally resolved — slug it here so the TOC link matches the id the page
  // output gets from the same pass.
  const resolved = applyHeadingSlugs(html)
  const re = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi
  let items = ''
  let match
  while ((match = re.exec(resolved)) !== null) {
    const attrs = match[2]
    if (/\bclass="[^"]*\bsr-only\b/i.test(attrs)) continue
    const id = (attrs.match(/\sid="([^"]*)"/i) || [])[1]
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    if (!id || !text) continue
    items += `<li class="toc-h${match[1]}"><a href="#${id}">${text}</a></li>`
  }
  if (!items) return ''
  return `<nav class="toc" aria-label="On this page"><ul>${items}</ul></nav>`
}

export function groupby(arr, key, datePart) {
  if (!Array.isArray(arr)) return []

  const map = new Map()
  const put = (groupKey, item) => {
    if (!map.has(groupKey)) map.set(groupKey, [])
    map.get(groupKey).push(item)
  }
  for (const item of arr) {
    let value = item[key]
    // Array value (e.g. `tags: [a, b]`) → item lands in each element's bucket,
    // so one post appears under every tag it carries.
    if (Array.isArray(value)) {
      for (const v of value) put(v != null ? String(v) : '', item)
      continue
    }
    if (datePart && value) {
      const date = new Date(value)
      if (!isNaN(date)) {
        switch (datePart) {
          case 'year': value = date.getUTCFullYear(); break
          case 'month': value = date.getUTCMonth() + 1; break
          case 'day': value = date.getUTCDate(); break
        }
      }
    }
    put(value != null ? String(value) : '', item)
  }

  return Array.from(map, ([key, items]) => ({ key, items }))
}

const FORMAT_PRIORITY = ['avif', 'webp']

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// jpeg sources compile to .jpg variants — same format for grouping purposes
function normalizeFormat(fmt) {
  return fmt === 'jpeg' ? 'jpg' : fmt
}

// Pick best format for srcset (highest priority format that has variants)
// and the middle-sized original-format variant as the src fallback.
function pickSrcsetAndSrc(variants, originalExt) {
  originalExt = normalizeFormat(originalExt)
  variants.sort((a, b) => a.width - b.width)

  const availableFormats = new Set(variants.map(v => normalizeFormat(v.format)))
  let srcsetFormat = null
  for (const fmt of FORMAT_PRIORITY) {
    if (availableFormats.has(fmt)) {
      srcsetFormat = fmt
      break
    }
  }
  if (!srcsetFormat && availableFormats.has(originalExt)) {
    srcsetFormat = originalExt
  }
  if (!srcsetFormat && availableFormats.size > 0) {
    srcsetFormat = [...availableFormats][0]
  }

  const srcsetVariants = srcsetFormat ? variants.filter(v => normalizeFormat(v.format) === srcsetFormat) : []

  const originalVariants = variants.filter(v => normalizeFormat(v.format) === originalExt)
  let srcVariant = null
  if (originalVariants.length > 0) {
    srcVariant = originalVariants[Math.floor((originalVariants.length - 1) / 2)]
  } else if (srcsetVariants.length > 0) {
    srcVariant = srcsetVariants[Math.floor((srcsetVariants.length - 1) / 2)]
  }

  return { srcVariant, srcsetVariants }
}

// Variant discovery from the poops-images compile cache: exact output paths
// and dimensions, no directory scan. By default only `{name}-{width}w.{ext}`
// outputs are srcset material. Pass `size` to instead build the srcset from a
// named crop/resize group (`thumb`) — poops-images tags each named variant with
// its size name in the cache, and the largest of the group drops the width
// suffix (`{name}-thumb.{ext}`), so widths come from the cache, not the filename.
function discoverImageVariantsFromCache(imagePath, outputDir, size) {
  const found = getImageEntry(imagePath, outputDir)
  if (!found) return null

  const { entry, prefixDir } = found
  const parsed = path.parse(imagePath)
  const originalExt = parsed.ext.replace('.', '')
  const sitePath = (p) => prefixDir ? toPosix(path.join(prefixDir, p)) : toPosix(p)
  const extOf = (p) => path.posix.extname(toPosix(p)).replace('.', '')

  if (size) {
    // Named group — every output tagged with this size name; widths from the cache
    const variants = (entry.outputs || [])
      .filter(o => o.name === size && o.width)
      .map(o => ({ path: sitePath(o.path), width: o.width, height: o.height, format: extOf(o.path) }))
    if (variants.length === 0) return null
    const { srcVariant, srcsetVariants } = pickSrcsetAndSrc(variants, originalExt)
    const src = srcVariant || srcsetVariants[srcsetVariants.length - 1] || variants[variants.length - 1]
    return { src: src.path, variants: srcsetVariants, width: src.width, height: src.height }
  }

  const variantPattern = new RegExp(`^${escapeRegExp(parsed.name)}-(\\d+)w\\.([a-z0-9]+)$`)
  const basePattern = new RegExp(`^${escapeRegExp(parsed.name)}\\.([a-z0-9]+)$`)

  const variants = []
  let base = null
  for (const out of entry.outputs || []) {
    const file = path.posix.basename(toPosix(out.path))
    // Named / preprocessed variants (they carry a `name`) are crops or effects
    // with their own aspect ratio — never mix them into the default width srcset.
    if (out.name) continue
    let match = file.match(variantPattern)
    if (match) {
      variants.push({ path: sitePath(out.path), width: parseInt(match[1], 10), height: out.height, format: match[2] })
      continue
    }
    match = file.match(basePattern)
    if (match && !base) {
      base = { path: sitePath(out.path), width: out.width, height: out.height }
    }
  }

  const { srcVariant, srcsetVariants } = pickSrcsetAndSrc(variants, originalExt)
  // Base output fixes the src extension when the source was converted (heic → jpg)
  const src = srcVariant || base || { path: imagePath }

  return { src: src.path, variants: srcsetVariants, width: src.width, height: src.height }
}

export function discoverImageVariants(imagePath, outputDir, size) {
  const fromCache = discoverImageVariantsFromCache(imagePath, outputDir, size)
  if (fromCache) return fromCache
  // A named size only exists in the compile cache — no directory-scan fallback.
  if (size) return { src: imagePath, variants: [] }

  const parsed = path.parse(imagePath)
  const dir = path.join(outputDir, parsed.dir)
  const baseName = parsed.name
  const originalExt = parsed.ext.replace('.', '')
  const pattern = /^(.+)-(\d+)w\.([a-z0-9]+)$/

  let files = []
  try {
    files = fs.readdirSync(dir)
  } catch {
    return { src: imagePath, variants: [] }
  }

  const variants = []
  for (const file of files) {
    const match = file.match(pattern)
    if (!match) continue
    const [, name, widthStr, format] = match
    if (name !== baseName) continue
    variants.push({
      path: toPosix(path.join(parsed.dir, file)),
      width: parseInt(widthStr, 10),
      format
    })
  }

  const { srcVariant, srcsetVariants } = pickSrcsetAndSrc(variants, originalExt)
  return { src: srcVariant ? srcVariant.path : imagePath, variants: srcsetVariants }
}

export function replaceOutExtensions(outputPath) {
  switch (path.extname(outputPath)) {
    case '.md':
      outputPath = outputPath.replace(/\.md$/, '.html')
      break
    case '.njk':
      outputPath = outputPath.replace(/\.njk$/, '.html')
      break
    case '.liquid':
      outputPath = outputPath.replace(/\.liquid$/, '.html')
      break
  }
  return outputPath
}

export function getUpDirPrefix(relativeDir) {
  if (relativeDir.trim() === '') return ''
  if (relativeDir.startsWith('/')) relativeDir = relativeDir.slice(1)
  if (relativeDir.endsWith('/')) relativeDir = relativeDir.slice(0, -1)
  const relativePathParts = relativeDir.split('/')
  let upDir = ''
  for (let i = 0; i < relativePathParts.length; i++) {
    upDir += '../'
  }
  return upDir
}

export function getRelativePathPrefix(outputDir, fromDir, baseURL) {
  if (baseURL != null) {
    return baseURL.endsWith('/') ? baseURL : baseURL + '/'
  }

  // getUpDirPrefix splits on `/`, so normalize away native separators
  let relativeDir = toPosix(path.relative(process.cwd(), outputDir))
  const fromRelativeDir = fromDir ? toPosix(path.relative(process.cwd(), fromDir)) : ''

  if (fromRelativeDir && relativeDir.startsWith(fromRelativeDir)) {
    relativeDir = relativeDir.replace(fromRelativeDir, '')
  }

  return getUpDirPrefix(relativeDir) || './'
}

export function getPageUrl(outputPath) {
  outputPath = replaceOutExtensions(outputPath)
  return toPosix(/index\.[a-z]+$/.test(path.basename(outputPath)) ? path.relative(process.cwd(), path.dirname(outputPath)) : path.relative(process.cwd(), outputPath))
}

export function getPageUrlRelativeToOutput(outputPath, outputDir) {
  const pageUrl = getPageUrl(outputPath)
  return toPosix(path.relative(outputDir, pageUrl))
}

export function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// `labels` (site.pagination) localizes the prev/next/of wording; English
// defaults. Author-supplied, but escaped anyway since it lands in HTML.
export function buildPaginationTag(pagination, prefix = '', labels = {}) {
  const totalPages = Number(pagination && pagination.totalPages) || 1
  if (totalPages <= 1) return ''

  const prev = escapeAttr(labels.prev || 'Previous')
  const next = escapeAttr(labels.next || 'Next')
  const of = escapeAttr(labels.of || 'of')

  const pageNumber = Number(pagination && pagination.pageNumber) || 1
  const parts = []
  if (pagination.prevPageUrl) parts.push(`<a href="${escapeAttr(prefix + pagination.prevPageUrl)}">${prev}</a>`)
  parts.push(`<span>${pageNumber} ${of} ${totalPages}</span>`)
  if (pagination.nextPageUrl) parts.push(`<a href="${escapeAttr(prefix + pagination.nextPageUrl)}">${next}</a>`)
  return parts.join('\n')
}

// Shared by the nunjucks and liquid `image` tags — attribute values may come
// from front-matter/user data, so they are escaped here, once for both engines.
export function buildImageTag(imagePath, prefix, kwargs, getOutputDir) {
  const alt = (kwargs && kwargs.alt) || ''
  const loading = (kwargs && kwargs.loading) || 'lazy'
  const isSvg = imagePath.endsWith('.svg')
  const attrs = [`alt="${escapeAttr(alt)}"`]

  if (isSvg) {
    attrs.unshift(`src="${escapeAttr(prefix + imagePath)}"`)
  } else {
    const { src, variants, width, height } = discoverImageVariants(imagePath, getOutputDir(), kwargs && kwargs.size)
    const sizes = (kwargs && kwargs.sizes) || '100vw'
    attrs.unshift(`src="${escapeAttr(prefix + src)}"`)
    if (width && height && !(kwargs && (kwargs.width || kwargs.height))) {
      attrs.push(`width="${width}"`, `height="${height}"`)
    }
    if (variants.length > 0) {
      const srcsetVal = variants.map(v => `${prefix}${v.path} ${v.width}w`).join(', ')
      attrs.push(`srcset="${escapeAttr(srcsetVal)}"`)
      attrs.push(`sizes="${escapeAttr(sizes)}"`)
    }
  }

  attrs.push(`loading="${escapeAttr(loading)}"`)
  if (kwargs) {
    const skip = new Set(['alt', 'sizes', 'loading', 'size'])
    for (const [key, val] of Object.entries(kwargs)) {
      // `__keywords` is nunjucks' kwargs marker, never a real attribute
      if (key.startsWith('__') || skip.has(key)) continue
      attrs.push(`${key}="${escapeAttr(val)}"`)
    }
  }
  return `<img ${attrs.join(' ')}>`
}

// Serializes a JSON-LD data object into a <script> block. Drops empty top-level
// keys (GEO parsers ignore them) and neutralizes `<`, `>`, `&` so front-matter
// values can't break out of the <script> or inject entities.
function jsonLdScript(data) {
  for (const k of Object.keys(data)) {
    if (data[k] === undefined || data[k] === null || data[k] === '') delete data[k]
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  return `<script type="application/ld+json">${json}</script>`
}

// Turns a URL segment (or a filename) into a human title for a breadcrumb crumb
// that has no page object of its own — same rule the nav tree uses for virtual
// parents. Strips a trailing extension, then dash/underscore → spaced Title Case.
function humanizeSegment(seg) {
  return humanize(String(seg).replace(/\.[a-z0-9]+$/i, ''))
}

// Builds a breadcrumb trail — a { name, path } array from the site root down to
// the page — derived purely from URL depth (no nav tree needed). Intermediate
// path segments are humanized (they have no page object); the last crumb is the
// page's own title. The home crumb (site root) leads unless disabled.
// `path` is the site-root-relative URL (page.url form: '' for home, no domain);
// each consumer prefixes it — the JSON-LD with `site.url` (absolute, required by
// Google), the visible filter with `relativePathPrefix` (so local-dev links stay
// on localhost instead of jumping to the production domain).
// Config: `site.breadcrumb` overlaid by front-matter `page.breadcrumb` (object
// with `home` boolean / `homeLabel` string); `breadcrumb: false` on either
// disables it. Returns [] for the homepage, a single-crumb trail, or when
// disabled — every caller renders nothing on [].
export function breadcrumbCrumbs(page, site = {}) {
  page = page || {}
  site = site || {}
  if (page.breadcrumb === false || site.breadcrumb === false) return []

  const cfg = { home: true, homeLabel: 'Home' }
  if (site.breadcrumb && typeof site.breadcrumb === 'object') Object.assign(cfg, site.breadcrumb)
  if (page.breadcrumb && typeof page.breadcrumb === 'object') Object.assign(cfg, page.breadcrumb)

  // Taxonomy term page: its URL segments (e.g. changelog/tag/feature) are not a
  // real page hierarchy — the `tag` segment has no page, and the last segment is
  // a slug, not the page title. Build the trail from the term hint instead:
  // Home > collection landing > term.
  if (page._taxonomy) {
    const t = page._taxonomy
    const crumbs = []
    if (cfg.home) crumbs.push({ name: cfg.homeLabel, path: '' })
    crumbs.push({ name: humanizeSegment(t.collection), path: t.collection })
    // prefix with the taxonomy label ("Tag: Feature") — the dropped `tag/` path
    // segment isn't a crumb, so this restores the "it's an archive" context
    const label = t.path ? `${humanizeSegment(t.path)}: ` : ''
    crumbs.push({ name: `${label}${humanizeSegment(t.term)}`, path: t.termUrl })
    return crumbs.length >= 2 ? crumbs : []
  }

  const rawUrl = page.url != null ? String(page.url) : ''
  if (rawUrl === '') return [] // homepage — you're already home

  const parts = rawUrl.split('/').filter(Boolean)
  const crumbs = []
  if (cfg.home) crumbs.push({ name: cfg.homeLabel, path: '' })

  // Every part but the last is an ancestor directory; accumulate its path.
  let acc = ''
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i]
    crumbs.push({ name: humanizeSegment(parts[i]), path: acc })
  }
  crumbs.push({ name: page.title || humanizeSegment(parts[parts.length - 1]), path: rawUrl })

  // A lone crumb (e.g. home off, top-level page) is not a trail.
  return crumbs.length >= 2 ? crumbs : []
}

// BreadcrumbList JSON-LD <script> for a page's position in the site hierarchy —
// a Google rich result. Absolute item URLs are mandatory, so it's skipped
// without `site.url` (like canonical). Names come from front matter / segments,
// so jsonLdScript escapes them for the <script> context.
function breadcrumbJsonLd(page, site) {
  if (!(site && site.url)) return ''
  const crumbs = breadcrumbCrumbs(page, site)
  if (crumbs.length < 2) return ''
  const baseUrl = String(site.url).replace(/\/+$/, '')
  const abs = (p) => {
    const rel = String(p).replace(/^\/+/, '')
    return rel ? `${baseUrl}/${rel}` : baseUrl
  }
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.path)
    }))
  })
}

// Builds a visible <nav> breadcrumb trail for display in the page body (blog
// posts, nested pages). Same crumbs as the JSON-LD, but hrefs are relative:
// `prefix` is the page's `relativePathPrefix`, so links resolve against the
// current output location (localhost in dev, the deployed path in prod) exactly
// like the nav/header links — never the absolute production domain. The last
// crumb renders as aria-current text (the current page is not a link). Returns
// '' when there's no trail. Names/paths land in attributes, so they're escaped.
export function buildBreadcrumb(page, site = {}, prefix = '') {
  const crumbs = breadcrumbCrumbs(page, site)
  if (crumbs.length < 2) return ''
  const items = crumbs.map((c, i) => {
    const name = escapeAttr(c.name)
    if (i === crumbs.length - 1) return `<li><span aria-current="page">${name}</span></li>`
    return `<li><a href="${escapeAttr(prefix + c.path)}">${name}</a></li>`
  })
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>`
}

// Builds a schema.org JSON-LD <script> block from a page's front matter + site
// data, for GEO / structured data (generative engines lean on schema.org to
// understand a page). @type auto-detects — BlogPosting when the page has a
// `date`, else WebPage. Article-only fields (headline, dates, author,
// wordCount) are added only for the article case. The publisher Organization
// gains a `logo` ImageObject when `site.logo` is set — Google Article rich
// results require it. On the homepage (page has no `url`) a second `WebSite`
// block is emitted, declaring the site name for search results.
// `site.jsonld` and `page.jsonld` (objects) are merged over the generated
// defaults — site-wide first, then the page — so a site can set a default
// @type (a docs site is TechArticle, not WebPage) and a page can still add or
// replace any field as a full escape hatch. Values come from front matter, so
// the JSON is escaped for a <script> context to prevent a `</script>`
// break-out (XSS).
export function buildJsonLd(page, site = {}) {
  page = page || {}
  site = site || {}

  const baseUrl = site.url ? String(site.url).replace(/\/+$/, '') : ''
  const absUrl = (u) => {
    if (!u) return undefined
    if (/^https?:\/\//i.test(u)) return u
    return baseUrl ? `${baseUrl}/${String(u).replace(/^\/+/, '')}` : u
  }

  const author = (page.author && typeof page.author === 'object' ? page.author.name : page.author) || site.author
  const publisherName = site.title || site.name

  let publisher
  if (publisherName) {
    publisher = { '@type': 'Organization', name: publisherName }
    const logo = absUrl(site.logo)
    if (logo) publisher.logo = { '@type': 'ImageObject', url: logo }
  }

  const isArticle = !!page.date
  const data = {
    '@context': 'https://schema.org',
    '@type': isArticle ? 'BlogPosting' : 'WebPage',
    name: page.title,
    description: pageDescription(page, site) || undefined,
    url: absUrl(page.url),
    inLanguage: page.lang || site.lang,
    image: absUrl(page.image || site.image),
    publisher
  }

  if (isArticle) {
    data.headline = page.title
    data.datePublished = page.date
    data.dateModified = page.updated || page.date
    if (author) data.author = { '@type': 'Person', name: author }
    if (page.wordcount) data.wordCount = page.wordcount
  }

  // site.jsonld then page.jsonld extend/override — the page wins. Shallow
  // merge — nested schema is rare and the escape hatch is meant for whole-key
  // replacement.
  if (site.jsonld && typeof site.jsonld === 'object') Object.assign(data, site.jsonld)
  if (page.jsonld && typeof page.jsonld === 'object') Object.assign(data, page.jsonld)

  const blocks = [jsonLdScript(data)]

  // Homepage (no page.url) gets a site-level WebSite block — defines the site
  // name for search results.
  if (!page.url && baseUrl) {
    blocks.push(jsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: publisherName,
      url: baseUrl,
      inLanguage: page.lang || site.lang
    }))
  }

  // Nested pages get a BreadcrumbList block (zero-config rich result).
  const breadcrumb = breadcrumbJsonLd(page, site)
  if (breadcrumb) blocks.push(breadcrumb)

  return blocks.join('\n')
}

// Builds Open Graph (+ a Twitter card) <meta> tags from a page's front matter
// and site data, for link previews on social/chat platforms. og:type is
// `article` when the page has a `date`, else `website`. Twitter tags fall back
// to the og:* values on most crawlers, so only `twitter:card` is emitted. A
// `page.og` object merges over (and overrides) the defaults — set any extra
// property there, e.g. `og:image:alt` or a fixed `twitter:card`. Values come
// from front matter and land in attributes, so they're escaped (escapeAttr).
export function buildOpenGraph(page, site = {}) {
  page = page || {}
  site = site || {}

  const baseUrl = site.url ? String(site.url).replace(/\/+$/, '') : ''
  const absUrl = (u) => {
    if (!u) return undefined
    if (/^https?:\/\//i.test(u)) return u
    return baseUrl ? `${baseUrl}/${String(u).replace(/^\/+/, '')}` : u
  }

  const author = (page.author && typeof page.author === 'object' ? page.author.name : page.author) || site.author
  const isArticle = !!page.date
  const image = absUrl(page.image || site.image)

  const tags = {
    'og:title': page.title || site.title,
    'og:description': pageDescription(page, site) || undefined,
    'og:type': isArticle ? 'article' : 'website',
    'og:url': absUrl(page.url),
    'og:site_name': site.title,
    'og:locale': page.lang || site.lang,
    'og:image': image,
    'twitter:card': image ? 'summary_large_image' : 'summary'
  }

  if (isArticle) {
    tags['article:published_time'] = page.date
    tags['article:modified_time'] = page.updated || page.date
    if (author) tags['article:author'] = author
  }

  // page.og extends/overrides. Shallow — one flat property:content map.
  if (page.og && typeof page.og === 'object') Object.assign(tags, page.og)

  const lines = []
  for (const [prop, val] of Object.entries(tags)) {
    if (val === undefined || val === null || val === '') continue
    // Twitter's spec uses name=, Open Graph uses property=.
    const attr = prop.startsWith('twitter:') ? 'name' : 'property'
    lines.push(`<meta ${attr}="${escapeAttr(prop)}" content="${escapeAttr(val)}">`)
  }
  return lines.join('\n')
}

// The one description chain: a page's own, then the paragraph it opens with,
// then the site's. og, JSON-LD and the meta tag all read it here so a page
// cannot describe itself three different ways.
export function pageDescription(page = {}, site = {}) {
  page = page || {}
  site = site || {}
  return page.description || page.excerpt || site.description || ''
}

// `<meta name="description">`, escaped. Poops renders with autoescape off, so a
// template interpolating the description itself ships whatever the front matter
// holds — and one `"` in a sentence closes the attribute and truncates the
// description to however many words came before it. Escaping belongs here, once,
// rather than in every layout that writes the tag.
export function buildMetaDescription(page, site = {}) {
  const description = pageDescription(page, site)
  return description ? `<meta name="description" content="${escapeAttr(description)}">` : ''
}

// Builds a `<link rel="canonical">` tag — the dedup signal that names a page's
// authoritative URL. The href is absolute (needs `site.url`): front matter
// `canonical` wins (an absolute URL as-is, or a path resolved against
// `site.url`), else the page's own `url`. Homepage (`url` === '') canonicals to
// the site root. Returns '' when no absolute URL can be formed (no site.url).
export function buildCanonical(page, site = {}) {
  page = page || {}
  site = site || {}

  const baseUrl = site.url ? String(site.url).replace(/\/+$/, '') : ''
  const abs = (u) => {
    if (u == null) return ''
    if (/^https?:\/\//i.test(u)) return u
    if (!baseUrl) return ''
    const rel = String(u).replace(/^\/+/, '')
    return rel ? `${baseUrl}/${rel}` : baseUrl
  }

  // The root index page has no `url` (poops leaves it unset), so a nullish url
  // means the homepage → canonical to the site root.
  const target = page.canonical != null ? page.canonical : (page.url != null ? page.url : '')
  const href = abs(target)
  return href ? `<link rel="canonical" href="${escapeAttr(href)}">` : ''
}
