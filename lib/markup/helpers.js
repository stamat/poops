import fs from 'node:fs'
import path from 'node:path'
import yaml from 'yaml'

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

const FORMAT_PRIORITY = ['avif', 'webp']

export function discoverImageVariants(imagePath, outputDir) {
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
      path: path.join(parsed.dir, file),
      width: parseInt(widthStr, 10),
      format
    })
  }

  variants.sort((a, b) => a.width - b.width)

  // Pick best format for srcset: highest priority format that has variants
  const availableFormats = new Set(variants.map(v => v.format))
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

  const srcsetVariants = srcsetFormat ? variants.filter(v => v.format === srcsetFormat) : []

  // Pick middle-sized variant in original format for src fallback
  const originalVariants = variants.filter(v => v.format === originalExt)
  let src = imagePath
  if (originalVariants.length > 0) {
    const mid = Math.floor((originalVariants.length - 1) / 2)
    src = originalVariants[mid].path
  } else if (srcsetVariants.length > 0) {
    const mid = Math.floor((srcsetVariants.length - 1) / 2)
    src = srcsetVariants[mid].path
  }

  return { src, variants: srcsetVariants }
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

export function getRelativePathPrefix(outputDir, fromDir) {
  let relativeDir = path.relative(process.cwd(), outputDir)
  const fromRelativeDir = fromDir ? path.relative(process.cwd(), fromDir) : ''

  if (fromRelativeDir && relativeDir.startsWith(fromRelativeDir)) {
    relativeDir = relativeDir.replace(fromRelativeDir, '')
  }

  return getUpDirPrefix(relativeDir)
}

export function getPageUrl(outputPath) {
  outputPath = replaceOutExtensions(outputPath)
  return /index\.[a-z]+$/.test(path.basename(outputPath)) ? path.relative(process.cwd(), path.dirname(outputPath)) : path.relative(process.cwd(), outputPath)
}

export function getPageUrlRelativeToOutput(outputPath, outputDir) {
  const pageUrl = getPageUrl(outputPath)
  return path.relative(outputDir, pageUrl)
}
