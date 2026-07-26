import fs from 'node:fs'
import { globSync } from 'glob'
import path from 'node:path'
import { slugify, humanize } from 'book-of-spells'
import log from '../utils/log.js'
import { mkDir, toPosix } from '../utils/helpers.js'
import { replaceOutExtensions, getRelativePathPrefix, getPageUrlRelativeToOutput, parseFrontMatter, wordcount, excerpt, groupby } from './helpers.js'

export function getSingleCollectionData(markupInDir, collectionName) {
  const collectionData = []
  // glob patterns must use `/` — on Windows `\` is an escape character
  globSync(toPosix(path.resolve(process.cwd(), markupInDir, collectionName, '**/*.+(html|njk|liquid|md)')), { ignore: ['**/index.+(html|njk|liquid|md)'] }).forEach((file) => {
    let frontMatter = {}

    let content = ''
    try {
      const frontMatterResult = parseFrontMatter(file)
      frontMatter = frontMatterResult.frontMatter
      content = frontMatterResult.content
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: file })
      console.error(err)
    }

    if (frontMatter.published === false) return

    if (!frontMatter.date) {
      // mtime is only a local-dev approximation — git clone resets it, so CI
      // builds date undated posts "now". The warning is the real fix.
      frontMatter.date = fs.statSync(file).mtime.toISOString().slice(0, 16)
      log({ tag: 'markup', warn: true, text: 'No date in front matter, falling back to file mtime:', link: file })
    }
    frontMatter.wordcount = wordcount(content)
    frontMatter.excerpt = excerpt(content)
    frontMatter.fileName = path.basename(file)
    frontMatter.filePath = path.relative(process.cwd(), file)
    frontMatter.collection = collectionName
    frontMatter.url = toPosix(path.join(collectionName, path.basename(frontMatter.filePath)))

    frontMatter.url = replaceOutExtensions(frontMatter.url)

    if (!frontMatter.title) {
      frontMatter.title = path.basename(frontMatter.filePath, path.extname(frontMatter.filePath))
    }
    collectionData.push(frontMatter)
  })

  return collectionData
}

export function collectionAutoDiscovery(markupInDir) {
  const indexFiles = globSync(toPosix(path.resolve(process.cwd(), markupInDir, '**/index.+(html|njk|liquid|md)')))

  const collectionData = {}

  for (const indexFile of indexFiles) {
    let frontMatter = {}

    try {
      const frontMatterResult = parseFrontMatter(indexFile)
      frontMatter = frontMatterResult.frontMatter
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: indexFile })
      console.error(err)
    }

    if (!frontMatter.collection) continue

    if (frontMatter.collection === true) {
      frontMatter.collection = path.basename(path.dirname(indexFile))
    }

    const collectionName = frontMatter.collection.trim()

    if (collectionName === '') continue

    frontMatter.name = collectionName
    const collection = buildCollectionObject(markupInDir, frontMatter)
    if (!collection) continue
    collectionData[collection.name] = collection
  }

  return collectionData
}

export function getCollectionDataBasedOnConfig(markupInDir, collectionConfig) {
  if (!collectionConfig) return {}

  const items = Array.isArray(collectionConfig)
    ? collectionConfig
    : [collectionConfig]

  const collectionData = {}

  for (let item of items) {
    if (typeof item === 'string') item = { name: item }
    if (!item || !item.name) continue
    const collection = buildCollectionObject(markupInDir, item)
    if (collection) collectionData[item.name] = collection
  }

  return collectionData
}

export function buildCollectionObject(markupInDir, collectionProtoObject) {
  const collection = {
    name: collectionProtoObject.name,
    items: getSingleCollectionData(markupInDir, collectionProtoObject.name)
  }

  if (collection.items.length === 0) return null

  if (collectionProtoObject.paginate && !isNaN(parseInt(collectionProtoObject.paginate))) {
    collection.paginate = parseInt(collectionProtoObject.paginate)
  }

  if (collectionProtoObject.sort) {
    collection.sort = collectionProtoObject.sort
  }

  if (typeof collection.sort === 'string') {
    collection.sort = { by: collection.sort }
  }

  if (!collection.sort) {
    collection.sort = { by: 'date' }
  }

  if (!collection.sort.by) {
    collection.sort.by = 'date'
  }

  if (collection.sort.by === 'date') {
    collection.sort.type = 'date'
  } else {
    collection.sort.type = 'alphabetical'
  }

  if (!collection.sort.order) {
    collection.sort.order = collection.sort.type === 'date' ? 'desc' : 'asc'
  }

  collection.items.sort((a, b) => {
    if (collection.sort.type === 'date') {
      if (collection.sort.order === 'asc') {
        return new Date(a[collection.sort.by]) - new Date(b[collection.sort.by])
      }

      return new Date(b[collection.sort.by]) - new Date(a[collection.sort.by])
    } else {
      const aVal = a[collection.sort.by]
      const bVal = b[collection.sort.by]
      if (aVal === bVal) return 0
      if (collection.sort.order === 'asc') {
        return aVal > bVal ? 1 : -1
      }

      return aVal < bVal ? 1 : -1
    }
  })

  if (collectionProtoObject.taxonomies) {
    collection._taxonomies = normalizeTaxonomies(collectionProtoObject.taxonomies, collection.paginate)
  }

  return collection
}

// Normalizes the `taxonomies` collection option into { name, path, paginate }.
// Accepts "tags" | ["tags", "category"] | [{ name, path, paginate }]. `name` is
// the front-matter field grouped on; `path` is the URL segment under the
// collection (defaults to `name`, so use `{ name: "tags", path: "tag" }` for a
// singular /tag/ URL); `paginate` falls back to the collection's page size.
function normalizeTaxonomies(config, defaultPaginate) {
  const items = Array.isArray(config) ? config : [config]
  const out = []
  for (let item of items) {
    if (typeof item === 'string') item = { name: item }
    if (!item || !item.name) continue
    const paginate = parseInt(item.paginate)
    out.push({
      name: item.name,
      path: item.path || item.name,
      paginate: !isNaN(paginate) ? paginate : defaultPaginate
    })
  }
  return out
}

// Chunks items into pages of `size`; no/invalid size → a single page holding all.
export function paginateItems(items, size) {
  if (!size || isNaN(size) || size < 1) return [items]
  const pages = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages.length ? pages : [items]
}

// Groups each collection's items by every configured taxonomy field and attaches
// collection.taxonomies = [{ name, path, terms: [{ term, slug, url, count,
// totalPages, pages, items }] }] — consumed by both the listing template (to link
// tag/category pages) and generateTaxonomyPages. Must run before any collection
// template renders so page 1 of the index can already see the term links.
// ponytail: two terms that slugify to the same slug collide on one URL (last
// write wins). Add a per-slug de-dupe counter if real tag sets ever clash.
export function buildTaxonomyData(collectionData) {
  if (!collectionData) return
  for (const name of Object.keys(collectionData)) {
    const collection = collectionData[name]
    if (!collection._taxonomies) continue
    collection.taxonomies = collection._taxonomies.map((tax) => {
      const terms = groupby(collection.items, tax.name)
        .filter((g) => g.key !== '')
        .map((g) => {
          const slug = slugify(g.key)
          const pages = paginateItems(g.items, tax.paginate)
          return {
            term: g.key,
            slug,
            url: toPosix(path.join(collection.name, tax.path, slug)),
            count: g.items.length,
            totalPages: pages.length,
            pages,
            items: g.items
          }
        })
      return { name: tax.name, path: tax.path, terms }
    })
  }
}

export function buildCollectionPaginationData(collectionData) {
  if (!collectionData) return

  for (const collectionName of Object.keys(collectionData)) {
    const collection = collectionData[collectionName]

    if (!collection.paginate) continue

    collection.pages = []
    let pageItems = []
    for (const item of collection.items) {
      if (pageItems.length === collection.paginate) {
        collection.pages.push(pageItems)
        pageItems = []
      }
      pageItems.push(item)
    }
    collection.pages.push(pageItems)

    collection.totalPages = collection.pages.length
  }
}

export function getCollectionIndexFile(markupInDir, collectionName) {
  const indexFiles = globSync(toPosix(path.resolve(process.cwd(), markupInDir, collectionName, 'index.+(html|njk|liquid|md)')))
  if (indexFiles.length === 0) return null
  return indexFiles[0]
}

export function pruneStalePaginationDirs(collectionName, markupInDir, markupOutDir, keepPages) {
  const outDir = path.resolve(process.cwd(), markupOutDir, collectionName)
  if (!fs.existsSync(outDir)) return

  for (const entry of fs.readdirSync(outDir)) {
    const pageNumber = parseInt(entry, 10)
    // pagination only ever writes out/<name>/2..totalPages/
    if (String(pageNumber) !== entry || pageNumber < 2 || pageNumber <= keepPages) continue
    // numeric dir mirrored from a real source dir — not pagination output
    if (fs.existsSync(path.resolve(process.cwd(), markupInDir, collectionName, entry))) continue
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true })
  }
}

// Renders a collection template once per page in `pages`, writing page 1 to
// out/<urlBase>/index.html and page N (2..) to out/<urlBase>/N/index.html.
// Shared by plain collection pagination and per-term taxonomy pages: the only
// differences are urlBase and the `extra` context merged onto the collection
// snapshot (taxonomy pages add activeTerm/activeTaxonomy and a term-filtered
// items/pageItems). Returns a promise per page.
function renderPages({ pages, urlBase, collection, extra, pageProps, titleBase, titleAlways, titleFormat, collectionName, collectionData, file, markupOutDir, compileEntryFn, baseURL }) {
  const promises = []
  const totalPages = pages.length

  for (let i = 0; i < totalPages; i++) {
    const pageNumber = i + 1
    const pageUrl = pageNumber === 1 ? urlBase : `${urlBase}/${pageNumber}`
    const nextPage = pageNumber === totalPages ? null : pageNumber + 1
    const nextPageUrl = nextPage === null ? null : `${urlBase}/${nextPage}`
    const prevPage = pageNumber === 1 ? null : pageNumber - 1
    let prevPageUrl = prevPage === null ? null : `${urlBase}/${prevPage}`
    if (prevPage === 1) prevPageUrl = urlBase

    // Snapshot per-page properties to avoid async mutation
    const pageSnapshot = {
      ...collection,
      ...extra,
      pageItems: pages[i],
      pageNumber,
      totalPages,
      pageUrl,
      nextPage,
      nextPageUrl,
      prevPage,
      prevPageUrl
    }

    const markupOut = path.resolve(process.cwd(), markupOutDir, pageUrl, 'index.html')
    const fromPath = path.resolve(process.cwd(), markupOutDir)
    const markupOutDirFull = path.dirname(markupOut)

    const context = {
      ...collectionData,
      [collectionName]: pageSnapshot,
      relativePathPrefix: getRelativePathPrefix(markupOutDirFull, fromPath, baseURL),
      // output-relative so page.url matches nav.json/index urls, same as compileDirectory
      _url: getPageUrlRelativeToOutput(markupOut, markupOutDir)
    }
    // extra props stamped onto page.* (compileEntry honors _page) — taxonomy
    // pages use it to feed the breadcrumb a correct term trail, and both paths
    // set a distinct title so <title>/og/jsonld don't duplicate across pages.
    // titleAlways overrides page 1 too (term pages want "Tag: Feature"); plain
    // pagination keeps page 1's front-matter title and only suffixes 2..N.
    const props = { ...pageProps }
    if (titleBase && (titleAlways || pageNumber > 1)) {
      props.title = pageNumber === 1
        ? titleBase
        : (titleFormat || '{title} — Page {n}')
            .replace('{title}', titleBase)
            .replace('{n}', pageNumber)
            .replace('{total}', totalPages)
    }
    if (Object.keys(props).length) context._page = props

    // mkDir only when a page is actually written: no empty pagination dirs
    // for index-less or unpublished (skipped) collection indexes
    promises.push(compileEntryFn(file, context).then(({ result, skipped }) => {
      if (skipped) return
      mkDir(markupOutDirFull)
      // async write so I/O overlaps rendering of the other pages
      return fs.promises.writeFile(markupOut, result)
    }))
  }

  return promises
}

export function generateCollectionPaginationPages(collectionData, markupInDir, markupOutDir, compileEntryFn, baseURL, site = {}) {
  if (!collectionData) return []

  const titleFormat = site.pagination && site.pagination.title
  const compilePromises = []

  for (const collectionName of Object.keys(collectionData)) {
    const collection = collectionData[collectionName]
    const file = getCollectionIndexFile(markupInDir, collectionName)

    if (!collection.totalPages || collection.totalPages === 0) {
      collection.totalPages = 1
      collection.pages = [collection.items]
    }

    // a shrunk page count (or removed index) leaves stale out/<name>/N/ dirs
    pruneStalePaginationDirs(collection.name, markupInDir, markupOutDir, file ? collection.totalPages : 1)

    if (!file) continue

    // base for "<title> — Page N" on pages 2..N (page 1 keeps its own title)
    const indexTitle = parseFrontMatter(file).frontMatter.title || humanize(collection.name)

    compilePromises.push(...renderPages({
      pages: collection.pages,
      urlBase: collection.name,
      collection,
      extra: {},
      titleBase: indexTitle,
      titleFormat,
      collectionName,
      collectionData,
      file,
      markupOutDir,
      compileEntryFn,
      baseURL
    }))
  }

  return compilePromises
}

// Removes stale output under out/<collection>/<tax.path>/: whole term-slug dirs
// for terms that no longer exist, plus leftover page dirs (2..) inside a
// surviving term whose page count shrank. Guarded so a real source subdir
// mirrored at the same path is never deleted.
export function pruneStaleTaxonomyDirs(collectionName, tax, markupInDir, markupOutDir, terms) {
  const taxDir = path.resolve(process.cwd(), markupOutDir, collectionName, tax.path)
  if (!fs.existsSync(taxDir)) return

  // never touch a taxonomy path that shadows a real source directory
  if (fs.existsSync(path.resolve(process.cwd(), markupInDir, collectionName, tax.path))) return

  const bySlug = new Map(terms.map((t) => [t.slug, t]))

  for (const entry of fs.readdirSync(taxDir)) {
    const slugDir = path.join(taxDir, entry)
    if (!fs.statSync(slugDir).isDirectory()) continue

    const term = bySlug.get(entry)
    if (!term) {
      fs.rmSync(slugDir, { recursive: true, force: true })
      continue
    }

    // surviving term: drop page-number dirs beyond its current totalPages
    for (const sub of fs.readdirSync(slugDir)) {
      const pageNumber = parseInt(sub, 10)
      if (String(pageNumber) !== sub || pageNumber < 2 || pageNumber <= term.totalPages) continue
      fs.rmSync(path.join(slugDir, sub), { recursive: true, force: true })
    }
  }
}

// Renders per-term taxonomy pages (e.g. changelog/tag/release/) using the
// collection's own index template. Each term page carries the term-filtered
// items/pageItems and activeTaxonomy/activeTerm so the shared template can show
// a heading and paginate. buildTaxonomyData must have run first.
export function generateTaxonomyPages(collectionData, markupInDir, markupOutDir, compileEntryFn, baseURL, site = {}) {
  if (!collectionData) return []

  const titleFormat = site.pagination && site.pagination.title
  const compilePromises = []

  for (const collectionName of Object.keys(collectionData)) {
    const collection = collectionData[collectionName]
    if (!collection.taxonomies) continue

    const file = getCollectionIndexFile(markupInDir, collectionName)

    for (const tax of collection.taxonomies) {
      // prune before the index check so removed tags are cleaned even if the
      // index template was deleted
      pruneStaleTaxonomyDirs(collectionName, tax, markupInDir, markupOutDir, file ? tax.terms : [])
      if (!file) continue

      for (const term of tax.terms) {
        compilePromises.push(...renderPages({
          pages: term.pages,
          urlBase: term.url,
          collection,
          // term-scope items so `.items` and `groupby(.items…)` also filter to
          // the term on its page, not the whole collection
          extra: { items: term.items, activeTaxonomy: tax.path, activeTerm: term.term, activeTermSlug: term.slug },
          // breadcrumb hint: Home > collection > term (the tag/ path segment has
          // no page, and page.title is the index's, not the term's)
          pageProps: { _taxonomy: { collection: collectionName, path: tax.path, term: term.term, termUrl: term.url } },
          // distinct <title>/og/jsonld per term ("Tag: Feature"), not the shared
          // index title — matches the breadcrumb crumb label
          titleBase: `${humanize(tax.path)}: ${humanize(term.term)}`,
          titleAlways: true,
          titleFormat,
          collectionName,
          collectionData,
          file,
          markupOutDir,
          compileEntryFn,
          baseURL
        }))
      }
    }
  }

  return compilePromises
}
