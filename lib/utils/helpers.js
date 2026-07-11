import fs from 'node:fs'
import { hasMagic } from 'glob'
import path from 'node:path'
import yaml from 'yaml'
import { convertGlobToRegex } from 'book-of-spells'

export function toPosix(filePath) {
  return path.sep === '/' ? filePath : filePath.split(path.sep).join('/')
}

export function pathExists() {
  return fs.existsSync(path.join(...arguments))
}

export function pathIsDirectory() {
  return fs.lstatSync(path.join(...arguments)).isDirectory()
}

export function mkDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

export function mkPath(filePath) {
  const dirPath = path.dirname(filePath)
  mkDir(dirPath)
}

export function pathForFile(filePath) {
  return path.extname(filePath) !== ''
}

export function insertMinSuffix(filePath) {
  const { name, ext } = path.parse(filePath)
  return path.join(path.dirname(filePath), `${name}.min${ext}`)
}

export function buildStyleOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name } = path.parse(inputPath)
  return path.join(path.join(outputPath, `${name}.css`))
}

export function fillBannerTemplate(template, packagesPath) {
  packagesPath = packagesPath || process.cwd()
  const packagesFilePath = path.join(packagesPath, 'package.json')
  if (!pathExists(packagesFilePath)) return template
  const pkg = JSON.parse(fs.readFileSync(packagesFilePath, 'utf-8'))
  const { name, version, homepage, description, license, author } = pkg
  const year = new Date().getFullYear()

  return template
    .replace(/{{\s?name\s?}}/g, name)
    .replace(/{{\s?version\s?}}/g, version)
    .replace(/{{\s?homepage\s?}}/g, homepage)
    .replace(/{{\s?description\s?}}/g, description)
    .replace(/{{\s?author\s?}}/g, author)
    .replace(/{{\s?license\s?}}/g, license)
    .replace(/{{\s?year\s?}}/g, year)
}

export function buildTime(start, end) {
  const time = Math.round(end - start)
  const minutes = Math.floor(time / 60000)
  const seconds = Math.floor(time / 1000) % 60
  const ms = time % 1000
  const parts = []
  if (minutes) parts.push(`${minutes}m`)
  if (seconds) parts.push(`${seconds}s`)
  if (ms) parts.push(`${ms}ms`)
  return parts.join(' ') || '0ms'
}

export function fileSize(filePath) {
  const stats = fs.statSync(filePath)
  const fileSizeInBytes = stats.size
  if (fileSizeInBytes < 1000) return `${fileSizeInBytes}B`
  if (fileSizeInBytes < 1000 * 1000) return `${(fileSizeInBytes / 1000).toFixed(0)}KB`
  if (fileSizeInBytes < 1000 * 1000 * 1000) {
    const kb = Math.floor((fileSizeInBytes % (1000 * 1000)) / 1000)
    return `${Math.floor(fileSizeInBytes / 1000 / 1000)}MB${kb ? ` ${kb}KB` : ''}`
  }
  const mb = Math.floor((fileSizeInBytes % (1000 * 1000 * 1000)) / 1000 / 1000)
  return `${Math.floor(fileSizeInBytes / 1000 / 1000 / 1000)}GB${mb ? ` ${mb}MB` : ''}`
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function readYamlFile(filePath) {
  try {
    return yaml.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`Error reading YAML file at ${filePath}:`, e)
    return null
  }
}

export function readDataFile(filePath) {
  if (/(\.json)$/i.test(filePath)) return readJsonFile(filePath)
  if (/(\.ya?ml)$/i.test(filePath)) return readYamlFile(filePath)
  return fs.readFileSync(filePath, 'utf8')
}

export function deleteDirectoryContents(directory) {
  if (!pathExists(directory)) return
  const files = fs.readdirSync(directory)

  for (const file of files) {
    const filePath = path.join(directory, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true })
    } else {
      fs.unlinkSync(filePath)
    }
  }
}

export function deleteDirectory(directory) {
  if (!pathExists(directory)) return
  fs.rmSync(directory, { recursive: true })
}

export function copyDirectory(src, dest) {
  if (!pathExists(src)) return

  if (!pathIsDirectory(src)) {
    fs.copyFileSync(src, dest)
    return
  }

  mkDir(dest)

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

export function stripDirNavSegments(filePath) {
  return toPosix(path.normalize(filePath)).replace(/(\.\.\/|\.\/|\/\.\.|\.\.\\|\.\\|\\\.\.)/g, '')
}

export function pathContainsPathSegment(filePath, segment) {
  // Watcher paths arrive with native separators, config segments with `/`
  filePath = toPosix(filePath)
  segment = stripDirNavSegments(segment)
  if (hasMagic(segment)) {
    segment = convertGlobToRegex(segment)
    if (!segment) return false
    return segment.test(filePath)
  } else {
    return filePath.includes(segment)
  }
}

export function doesFileBelongToPath(filePath, configPaths) {
  if (!configPaths) return false
  if (!Array.isArray(configPaths)) configPaths = [configPaths]
  for (const configPath of configPaths) {
    if (!configPath.in) continue
    const configInPaths = Array.isArray(configPath.in) ? configPath.in : [configPath.in]
    for (const inPath of configInPaths) {
      if (pathContainsPathSegment(filePath, inPath)) {
        return {
          in: inPath,
          out: configPath.out || null
        }
      }
    }
  }
  return false
}

// Derive the watch list from every task's `in` path when watch is `true`.
// File entries (scripts/styles/reactor) resolve to their parent dir so sibling
// imports still retrigger a rebuild; dir entries (markup/copy/images) are
// watched as-is. Imports that reach outside a task's own dir aren't covered —
// use an explicit `watch` array for that. includePaths is skipped on purpose:
// it defaults to node_modules, which must never be watched.
export function deriveWatchDirs(config) {
  const paths = []
  const collect = (task) => {
    if (!task) return
    for (const entry of [].concat(task)) {
      if (!entry || typeof entry !== 'object') continue
      if (entry.in) paths.push(...(Array.isArray(entry.in) ? entry.in : [entry.in]))
      if (entry.component) paths.push(entry.component) // reactor source component
      const tokenPaths = entry.options && entry.options.tokenPaths
      if (tokenPaths) paths.push(...[].concat(tokenPaths))
    }
  }
  collect(config.scripts)
  collect(config.styles)
  collect(config.reactor)
  collect(config.markup)
  collect(config.copy)
  collect(config.images)
  // ponytail: extname()-based dir/file split misreads dot-named dirs (rare);
  // the escape hatch is an explicit watch array.
  return [...new Set(paths.map((p) => (path.extname(p) ? path.dirname(p) : p)))]
    .filter((p) => p && p !== '.')
}
