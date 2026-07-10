import fs from 'node:fs'
import path from 'node:path'
import yaml from 'yaml'
import { toPosix } from '../utils/helpers.js'
import { getImageEntry } from './image-cache.js'

const frontMatterCache = new Map()

export function parseFrontMatter(filePath) {
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (e) {
    throw new Error(`Error stating file at ${filePath}: ${e.message}`)
  }

  const cached = frontMatterCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return { frontMatter: { ...cached.value.frontMatter }, content: cached.value.content }
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
    return { frontMatter: {}, content }
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
  return { frontMatter: { ...frontMatter }, content: contentWithoutFrontMatter }
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
export function renderToc(html) {
  if (!html) return ''
  const re = /<h([23])\b[^>]*\sid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi
  let items = ''
  let match
  while ((match = re.exec(html)) !== null) {
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    if (!match[2] || !text) continue
    items += `<li class="toc-h${match[1]}"><a href="#${match[2]}">${text}</a></li>`
  }
  if (!items) return ''
  return `<nav class="toc" aria-label="On this page"><ul>${items}</ul></nav>`
}

export function groupby(arr, key, datePart) {
  if (!Array.isArray(arr)) return []

  const map = new Map()
  for (const item of arr) {
    let value = item[key]
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
    const groupKey = value != null ? String(value) : ''
    if (!map.has(groupKey)) map.set(groupKey, [])
    map.get(groupKey).push(item)
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
// and dimensions, no directory scan. Only `{name}-{width}w.{ext}` outputs are
// srcset material — named sizes (`-thumb-200w`) and preprocessed outputs
// (`-blurred-...`) are crops or effects with their own aspect ratios.
function discoverImageVariantsFromCache(imagePath, outputDir) {
  const found = getImageEntry(imagePath, outputDir)
  if (!found) return null

  const { entry, prefixDir } = found
  const parsed = path.parse(imagePath)
  const originalExt = parsed.ext.replace('.', '')
  const variantPattern = new RegExp(`^${escapeRegExp(parsed.name)}-(\\d+)w\\.([a-z0-9]+)$`)
  const basePattern = new RegExp(`^${escapeRegExp(parsed.name)}\\.([a-z0-9]+)$`)

  const variants = []
  let base = null
  for (const out of entry.outputs || []) {
    const file = path.posix.basename(toPosix(out.path))
    const sitePath = prefixDir ? toPosix(path.join(prefixDir, out.path)) : toPosix(out.path)
    let match = file.match(variantPattern)
    if (match) {
      variants.push({ path: sitePath, width: parseInt(match[1], 10), height: out.height, format: match[2] })
      continue
    }
    match = file.match(basePattern)
    if (match && !base) {
      base = { path: sitePath, width: out.width, height: out.height }
    }
  }

  const { srcVariant, srcsetVariants } = pickSrcsetAndSrc(variants, originalExt)
  // Base output fixes the src extension when the source was converted (heic → jpg)
  const src = srcVariant || base || { path: imagePath }

  return { src: src.path, variants: srcsetVariants, width: src.width, height: src.height }
}

export function discoverImageVariants(imagePath, outputDir) {
  const fromCache = discoverImageVariantsFromCache(imagePath, outputDir)
  if (fromCache) return fromCache

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
    const { src, variants, width, height } = discoverImageVariants(imagePath, getOutputDir())
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
    const skip = new Set(['alt', 'sizes', 'loading'])
    for (const [key, val] of Object.entries(kwargs)) {
      // `__keywords` is nunjucks' kwargs marker, never a real attribute
      if (key.startsWith('__') || skip.has(key)) continue
      attrs.push(`${key}="${escapeAttr(val)}"`)
    }
  }
  return `<img ${attrs.join(' ')}>`
}
