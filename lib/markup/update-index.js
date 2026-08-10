import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { toPosix } from '../utils/helpers.js'
import log from '../utils/log.js'

// Last-updated dates without git: a committed index of content hashes, one
// entry per source file. A build hashes each page's body — front matter sits
// outside the hash, so a retitle or a new tag is not an edit — and only a hash
// that differs takes the file's mtime as the page's new `updated` date. Every
// build after that reads the same date back, so a rebuild, a fresh clone and CI
// all agree.
//
// The whole thing rests on one habit: the index is committed, and a build runs
// before the commit. Without that the index arriving on CI is a build behind,
// and the pages it does not recognise get stamped with clone time.

const DEFAULT_INDEX = '.poops-updates.json'

let indexPath = null
let pagesRoot = null
let entries = null
let seen = null
let changed = 0

// Opened per full compile: rereads the file (so an index pulled in from another
// branch mid-watch is picked up) and starts a fresh seen-set for pruning.
export function openUpdateIndex(config, markupIn) {
  if (!config) {
    indexPath = null
    pagesRoot = null
    entries = null
    seen = null
    return
  }

  indexPath = path.resolve(process.cwd(), config === true ? DEFAULT_INDEX : String(config))
  pagesRoot = path.resolve(process.cwd(), markupIn)
  entries = readIndex(indexPath)
  seen = new Set()
  changed = 0
}

// The engines parse front matter for every template they load, layouts and
// partials included, so the funnel sees more than pages. A date is only a page's
// — anything under an `_` directory is Poops's own convention for "not a page",
// and a template reached through includePaths (a theme in node_modules) sits
// outside the markup directory entirely.
function isPageSource(absolutePath) {
  const relative = path.relative(pagesRoot, absolutePath)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false
  return !relative.split(path.sep).some((segment) => segment.startsWith('_'))
}

function readIndex(file) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return {} // no index yet — first build stamps every page
  }

  try {
    const data = JSON.parse(raw)
    if (data && typeof data === 'object' && !Array.isArray(data)) return data
  } catch { /* falls through to the warning */ }

  log({ tag: 'markup', warn: true, text: 'Unreadable update index, restamping every page:', link: path.relative(process.cwd(), file) })
  return {}
}

// Stamps `updated` onto a page's front matter, mutating the copy parseFrontMatter
// hands out. No-op while the index is closed, which is what keeps `page.updated`
// undefined for everyone who never turned the feature on.
export function stampUpdatedDate(filePath, frontMatter, content, mtimeMs) {
  if (!entries) return
  // A hand-written `updated` is the author's answer; the index neither reads
  // nor records that page, so deleting the field later restamps it as new.
  if (frontMatter.updated) return

  const absolutePath = path.resolve(filePath)
  if (!isPageSource(absolutePath)) return

  const key = toPosix(path.relative(process.cwd(), absolutePath))
  seen.add(key)

  const hash = createHash('sha1').update(content).digest('hex')
  const previous = entries[key]

  if (!previous || previous.hash !== hash) {
    entries[key] = { hash, updated: new Date(mtimeMs).toISOString() }
    changed++
  }

  frontMatter.updated = entries[key].updated
}

// Written at the end of a compile, and only when something actually changed —
// an unchanged index left untouched is what stops a watch build from rewriting
// a file the watcher may be looking at, over and over.
export function saveUpdateIndex({ prune = false } = {}) {
  if (!entries) return

  // Pruning is for full builds only: an incremental rebuild parses the pages it
  // rebuilds and nothing else, so its seen-set would condemn the whole site.
  if (prune && seen.size) {
    for (const key of Object.keys(entries)) {
      if (seen.has(key)) continue
      delete entries[key]
      changed++
    }
  }

  if (!changed) return

  // Sorted keys keep a content edit to one line of the diff, and keep two
  // branches editing different pages out of each other's conflicts.
  const sorted = {}
  for (const key of Object.keys(entries).sort()) sorted[key] = entries[key]
  entries = sorted

  fs.mkdirSync(path.dirname(indexPath), { recursive: true })
  fs.writeFileSync(indexPath, JSON.stringify(sorted, null, 2) + '\n')

  // The dates only survive the next clone if this file travels with the pages
  // it describes, and nothing else in a build says so out loud
  const relative = path.relative(process.cwd(), indexPath)
  log({ tag: 'markup', text: `Updated dates changed for ${changed} page${changed > 1 ? 's' : ''} — commit`, link: relative })
  changed = 0
}
