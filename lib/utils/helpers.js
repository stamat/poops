import fs from 'node:fs'
import { hasMagic } from 'glob'
import path from 'node:path'
import yaml from 'yaml'
import { convertGlobToRegex } from 'book-of-spells'
import { unknownKeys } from 'unknown-keys'

// The esbuild target scripts and reactor bundles compile to when an entry
// doesn't set its own. ES2020 is where optional chaining and nullish
// coalescing live — the syntax people write today, which an older target
// would lower into helpers for browsers that have supported it since 2020.
export const DEFAULT_TARGET = 'es2020'

// Every key poops.json may carry. A key outside this set is a typo the CLI
// warns about (see poops.js) — `stlyes` would otherwise be silently ignored.
// `$schema` is inert: editors read it for completion, Poops never does.
// `pkg` feeds banner templates; `reactorData` is set internally but tolerated
// here in case a config hardcodes it. Lives beside the runners rather than in
// poops.js so schema/poops.schema.json can be checked against it.
export const KNOWN_CONFIG_KEYS = new Set(['$schema', 'watch', 'includePaths', 'scripts', 'styles', 'postcss', 'reactor', 'markup', 'copy', 'images', 'serve', 'livereload', 'exec', 'banner', 'pkg', 'reactorData'])

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

// `index` is a directory entry point — name the output after the directory, so
// `src/elements/accordion/index.scss` outputs `accordion.css`. Only applied to
// glob matches: a literal `in: 'src/index.js'` keeps its own basename, since
// renaming it to `src.js` would silently move an explicitly named output.
export function isIndexEntry(inputPath) {
  const { dir, name } = path.parse(inputPath)
  return name === 'index' && !!dir && dir !== '.' && dir !== '..'
}

// The static prefix of a glob — everything before its first magic segment.
// `src/elements/*/index.ts` → `src/elements`, `src/*/accordion/index.ts` → `src`.
// Derived from the pattern alone, so it doesn't shift with what happened to match.
export function globBase(pattern) {
  const parts = toPosix(pattern).split('/')
  const magicAt = parts.findIndex(part => hasMagic(part, { magicalBraces: true }))
  return parts.slice(0, magicAt === -1 ? -1 : magicAt).join('/')
}

// Extension-less output path for a glob-matched `index.*`: the directory name,
// keeping whatever nesting the glob's static prefix doesn't already account for.
// A glob spanning several groups (`src/*/accordion/index.ts`) therefore stays
// apart as `blocks/accordion` and `elements/accordion` instead of colliding.
export function indexEntryOut(inputPath, base) {
  const dir = path.posix.dirname(toPosix(inputPath))
  const rel = base ? path.posix.relative(base, dir) : dir
  return rel || path.posix.basename(dir)
}

// The `index.*` rename only saves entry points named `index` — every other
// glob match still collapses onto its own basename, so `src/elements/*/theme.scss`
// writes `theme.css` once per element and the last one wins. An `out` carrying
// `{{dir}}`/`{{name}}` names one output per match instead.
export function hasOutTemplate(outputPath) {
  return /{{\s*(dir|name)\s*}}/.test(outputPath)
}

// `{{dir}}` is the match's directory relative to the glob's static prefix (the
// same name `index.*` entries get), `{{name}}` its extension-less basename.
export function fillOutTemplate(template, inputPath, base) {
  const { name } = path.parse(inputPath)
  return template
    .replace(/{{\s*dir\s*}}/g, indexEntryOut(inputPath, base))
    .replace(/{{\s*name\s*}}/g, name)
}

// What an entry's outputs are named relative to: a glob's static prefix, or a
// literal entry's own directory (so `{{dir}}` is that directory's name).
export function entryBase(entry) {
  return hasMagic(entry, { magicalBraces: true }) ? globBase(entry) : path.posix.dirname(toPosix(entry))
}

// The fixed directory a templated `out` writes into — everything before its
// first token. Only the tail varies per entry point, so this is the one part
// esbuild (and the watcher's output zones) can be handed up front.
export function outTemplateBase(outputPath) {
  return path.posix.dirname(toPosix(outputPath).replace(/\{\{.*$/, ''))
}

// esbuild names an entry point's output itself, from an `out` that is relative
// to `outdir` and carries no extension. Resolve the `out` template into that
// shape so a templated scripts `out` goes through the same machinery the
// `index.*` rename already uses.
export function fillOutTemplateEntry(template, inputPath, base, outBase) {
  const filled = toPosix(fillOutTemplate(template, inputPath, base))
  return path.posix.relative(outBase, filled).replace(/\.[^./]*$/, '')
}

export function buildStyleOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name } = path.parse(inputPath)
  return path.join(outputPath, `${name}.css`)
}

// Every package the project declares, across all four dependency fields.
// A top-level config key naming one of these is a companion reading the same
// poops.json — septic's `septic` block, say — not a typo, so poops.js stays
// quiet about it. Poops never loads the package; it only stops calling the key
// a mistake, which is why declaration is enough and an install is not checked.
// An unreadable or absent package.json degrades to the empty set: every unknown
// key is warned about again, which is exactly the behaviour before this existed.
export function projectPackageNames(projectPath) {
  const packagesFilePath = path.join(projectPath || process.cwd(), 'package.json')
  if (!pathExists(packagesFilePath)) return new Set()
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(packagesFilePath, 'utf-8'))
  } catch {
    return new Set()
  }
  return new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {})
  ])
}

// Misspelt keys below the top level, which poops.js warns about. The key sets
// come off the published schema rather than a second list in here, and
// `additionalProperties` there is what says who owns a block: `false` is one
// Poops can rule on, `true` — `images`, `site` — is one somebody else names the
// keys of. The root is neither, so nothing here fires at the top level;
// poops.js owns that check, which alone can tell a companion's block from a
// typo.
//
// Key names only, never types: `"minfiy"` in a style's options is read by
// nothing and silently costs you the minified file, while `"minify": "yes"`
// reaches the compiler and fails there. A schema that cannot be read leaves the
// build to run unadvised rather than taking it down over a diagnostic.
export function unknownConfigKeys(config, schema) {
  // exec is validateExec's, and it names the consequence — that the stage never
  // runs. Two warnings for one typo is noise.
  return unknownKeys(config, schema).filter(({ path }) => path !== 'exec')
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

// mtime+size-keyed memo (same pattern as the front matter cache): a watch
// change to one data file re-reads only that file instead of re-parsing every
// data file on each reload. Entries self-invalidate; callers share the parsed
// object across reloads, so treat it as read-only.
const dataFileCache = new Map()

export function readDataFile(filePath) {
  const stat = fs.statSync(filePath)
  const cached = dataFileCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.value

  let value
  if (/(\.json)$/i.test(filePath)) value = readJsonFile(filePath)
  else if (/(\.ya?ml)$/i.test(filePath)) value = readYamlFile(filePath)
  else value = fs.readFileSync(filePath, 'utf8')

  dataFileCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, value })
  return value
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

// Index in filePath's segment list where `segParts` first appears as a
// contiguous run, or -1. Segment-boundary matching: `src` matches `src/app.js`
// and `x/src/y` but never `mysrc/app.js` or `dist/src-maps/x` — a plain
// substring test would false-positive on all three.
function findSegmentRun(fileParts, segParts) {
  if (segParts.length === 0) return -1
  for (let i = 0; i + segParts.length <= fileParts.length; i++) {
    let match = true
    for (let j = 0; j < segParts.length; j++) {
      if (fileParts[i + j] !== segParts[j]) { match = false; break }
    }
    if (match) return i
  }
  return -1
}

export function pathContainsPathSegment(filePath, segment) {
  // Watcher paths arrive with native separators, config segments with `/`
  filePath = toPosix(filePath)
  segment = stripDirNavSegments(segment)
  if (hasMagic(segment, { magicalBraces: true })) {
    segment = convertGlobToRegex(segment)
    if (!segment) return false
    return segment.test(filePath)
  }
  const segParts = segment.split('/').filter(Boolean)
  return findSegmentRun(filePath.split('/').filter(Boolean), segParts) !== -1
}

// Swaps the first segment-boundary occurrence of `from` in `filePath` for
// `to`, both posix. Segment-aware so `src`→`dist` on `mysrc/src/x` rewrites the
// real `src` segment, not the substring inside `mysrc` (what String.replace would hit).
export function replacePathSegment(filePath, from, to) {
  const fileParts = toPosix(filePath).split('/')
  const nonEmpty = fileParts.filter(Boolean)
  const offset = fileParts.length - nonEmpty.length // leading '' from an absolute path
  const fromParts = toPosix(from).split('/').filter(Boolean)
  const at = findSegmentRun(nonEmpty, fromParts)
  if (at === -1) return toPosix(filePath)
  const i = at + offset
  return [...fileParts.slice(0, i), to, ...fileParts.slice(i + fromParts.length)].join('/')
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
