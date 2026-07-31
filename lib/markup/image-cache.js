import fs from 'node:fs'
import path from 'node:path'
import { toPosix } from '../utils/helpers.js'

// Compile cache written by poops-images (https://github.com/stamat/poops-images)
// next to the images it generates. Holds exact output paths, dimensions and EXIF.
const CACHE_FILENAME = '.poops-images-cache.json'

const cacheFileCache = new Map()

function readCacheFile(cachePath) {
  let stat
  try {
    stat = fs.statSync(cachePath)
  } catch {
    return null
  }

  const cached = cacheFileCache.get(cachePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.data
  }

  let data = null
  try {
    data = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  } catch {
    return null
  }

  // Every lookup below keys on posix paths (the cache is keyed by path relative
  // to the cache dir). A cache written on Windows carries backslash keys and
  // then nothing ever matches — normalize once here rather than at each site.
  // Not toPosix: that is a no-op on a posix host, and a cache generated on
  // Windows can be read on one — committed alongside the images it describes,
  // or built in CI. A literal backslash in an image filename is not a thing.
  if (data && data.entries) data.entries = posixKeys(data.entries)

  cacheFileCache.set(cachePath, { mtimeMs: stat.mtimeMs, size: stat.size, data })
  return data
}

function posixKeys(entries) {
  const toSlash = (p) => String(p).replace(/\\/g, '/')
  const out = {}
  for (const [key, value] of Object.entries(entries)) {
    // Variant paths land in srcset attributes, so they need the same treatment
    out[toSlash(key)] = Array.isArray(value.outputs)
      ? { ...value, outputs: value.outputs.map((o) => ({ ...o, path: toSlash(o.path) })) }
      : value
  }
  return out
}

// Containment, the way lib/server.js does it: a plain startsWith(root) also
// accepts a sibling whose name merely starts with root's — `dist-old` for
// `dist` — so a `../` in a template's path argument reads a cache outside the
// output dir.
function isInside(dir, root) {
  return dir === root || dir.startsWith(root + path.sep)
}

export function clearImageCache() {
  cacheFileCache.clear()
}

// Finds the poops-images cache entry for a site-relative image path.
// Walks from the image's directory up to outputDir, since the cache file sits
// at the root of the images output dir, which may be a subdirectory of the
// site output (e.g. dist/images/.poops-images-cache.json).
// Returns { entry, prefixDir } where prefixDir is the cache dir relative to
// outputDir (output paths in the cache are relative to the cache dir), or null.
export function getImageEntry(imagePath, outputDir) {
  const root = path.resolve(outputDir)
  let dir = path.resolve(root, path.dirname(imagePath))
  if (!isInside(dir, root)) return null

  const target = toPosix(path.relative(root, path.resolve(root, imagePath)))
  const targetNoExt = target.replace(/\.[^./]+$/, '')

  while (true) {
    const data = readCacheFile(path.join(dir, CACHE_FILENAME))
    if (data && data.entries) {
      const prefixDir = toPosix(path.relative(root, dir))
      const rel = prefixDir ? target.slice(prefixDir.length + 1) : target
      let entry = data.entries[rel]
      if (!entry) {
        // Output extension may differ from the source key (heic → jpg, jpeg → jpg)
        const relNoExt = prefixDir ? targetNoExt.slice(prefixDir.length + 1) : targetNoExt
        for (const [key, value] of Object.entries(data.entries)) {
          if (key.replace(/\.[^./]+$/, '') === relNoExt) {
            entry = value
            break
          }
        }
      }
      if (entry) return { entry, prefixDir }
    }
    if (dir === root) return null
    dir = path.dirname(dir)
  }
}

export function getImageExif(imagePath, outputDir) {
  const found = getImageEntry(imagePath, outputDir)
  return (found && found.entry.exif) || null
}

// Lists all cache entries under a site-relative directory, gallery-ready:
// site-relative paths, `date` flattened from EXIF (file mtime fallback) so
// engine-native sort and the groupby filter work without touching nested exif.
export function listImages(dirPath, outputDir) {
  const root = path.resolve(outputDir)
  const clean = toPosix(dirPath || '').replace(/^\/+|\/+$/g, '')
  let dir = path.resolve(root, clean)
  if (!isInside(dir, root)) return []

  while (true) {
    const data = readCacheFile(path.join(dir, CACHE_FILENAME))
    if (data && data.entries) {
      const prefixDir = toPosix(path.relative(root, dir))
      const scope = toPosix(path.relative(dir, path.resolve(root, clean)))
      const sitePath = (p) => prefixDir ? toPosix(path.join(prefixDir, p)) : toPosix(p)

      const images = []
      for (const [key, entry] of Object.entries(data.entries)) {
        if (scope && !key.startsWith(scope + '/')) continue
        images.push({
          path: sitePath(key),
          width: entry.width,
          height: entry.height,
          date: (entry.exif && entry.exif.dateTime) || (entry.mtime ? new Date(entry.mtime).toISOString() : null),
          exif: entry.exif || null,
          outputs: (entry.outputs || []).map(o => ({ ...o, path: sitePath(o.path) }))
        })
      }
      return images
    }
    if (dir === root) return []
    dir = path.dirname(dir)
  }
}
