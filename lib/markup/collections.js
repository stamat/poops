import fs from 'node:fs'
import { globSync } from 'glob'
import path from 'node:path'
import log from '../utils/log.js'
import { mkDir, toPosix } from '../utils/helpers.js'
import { replaceOutExtensions, getRelativePathPrefix, getPageUrlRelativeToOutput, parseFrontMatter, wordcount } from './helpers.js'

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

  return collection
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

export function generateCollectionPaginationPages(collectionData, markupInDir, markupOutDir, compileEntryFn, baseURL) {
  if (!collectionData) return []

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

    for (let i = 0; i < collection.totalPages; i++) {
      const pageNumber = i + 1
      const pageUrl = pageNumber === 1 ? collection.name : `${collection.name}/${pageNumber}`
      const nextPage = pageNumber === collection.totalPages ? null : pageNumber + 1
      const nextPageUrl = pageNumber === collection.totalPages ? null : `${collection.name}/${pageNumber + 1}`
      const prevPage = pageNumber === 1 ? null : pageNumber - 1
      let prevPageUrl = pageNumber === 1 ? null : `${collection.name}/${pageNumber - 1}`
      if (prevPage === 1) {
        prevPageUrl = collection.name
      }

      // Snapshot per-page properties to avoid async mutation
      const pageSnapshot = {
        ...collection,
        pageItems: collection.pages[i],
        pageNumber,
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

      // mkDir only when a page is actually written: no empty pagination dirs
      // for index-less or unpublished (skipped) collection indexes
      const compilePromise = compileEntryFn(file, context).then(({ result, skipped }) => {
        if (skipped) return
        mkDir(markupOutDirFull)
        // async write so I/O overlaps rendering of the other pages
        return fs.promises.writeFile(markupOut, result)
      })
      compilePromises.push(compilePromise)
    }
  }

  return compilePromises
}
