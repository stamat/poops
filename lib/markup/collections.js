import fs from 'node:fs'
import { globSync } from 'glob'
import path from 'node:path'
import log from '../utils/log.js'
import { parseFrontMatter, mkDir } from '../utils/helpers.js'
import { replaceOutExtensions, getRelativePathPrefix, getPageUrl } from './helpers.js'

export function getSingleCollectionData(markupInDir, collectionName) {
  const collectionData = []
  globSync(path.join(process.cwd(), markupInDir, collectionName, '**/*.+(html|njk|md)'), { ignore: ['**/index.+(html|njk|md)'] }).forEach((file) => {
    let frontMatter = {}

    try {
      const frontMatterResult = parseFrontMatter(file)
      frontMatter = frontMatterResult.frontMatter
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: file })
      console.error(err)
    }

    if (frontMatter.published === false) return

    if (!frontMatter.date) {
      frontMatter.date = fs.statSync(file).ctime.toISOString().slice(0, 16)
    }
    frontMatter.fileName = path.basename(file)
    frontMatter.filePath = path.relative(process.cwd(), file)
    frontMatter.collection = collectionName
    frontMatter.url = path.join(collectionName, path.basename(frontMatter.filePath))

    frontMatter.url = replaceOutExtensions(frontMatter.url)

    if (!frontMatter.title) {
      frontMatter.title = path.basename(frontMatter.filePath, path.extname(frontMatter.filePath))
    }
    collectionData.push(frontMatter)
  })

  return collectionData
}

export function collectionAutoDiscovery(markupInDir) {
  const indexFiles = globSync(path.join(process.cwd(), markupInDir, '/**/index.+(html|njk|md)'))

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
  const indexFiles = globSync(path.join(process.cwd(), markupInDir, collectionName, 'index.+(html|njk|md)'))
  if (indexFiles.length === 0) return null
  return indexFiles[0]
}

export function generateCollectionPaginationPages(collectionData, markupInDir, markupOutDir, compileEntryFn) {
  if (!collectionData) return []

  const compilePromises = []

  for (const collectionName of Object.keys(collectionData)) {
    const collection = collectionData[collectionName]
    const file = getCollectionIndexFile(markupInDir, collectionName)

    if (!collection.totalPages || collection.totalPages === 0) {
      collection.totalPages = 1
      collection.pages = [collection.items]
    }

    for (let i = 0; i < collection.totalPages; i++) {
      collection.pageItems = collection.pages[i]
      collection.pageNumber = i + 1
      collection.pageUrl = collection.pageNumber === 1 ? collection.name : `${collection.name}/${collection.pageNumber}`
      collection.nextPage = collection.pageNumber === collection.totalPages ? null : collection.pageNumber + 1
      collection.nextPageUrl = collection.pageNumber === collection.totalPages ? null : `${collection.name}/${collection.pageNumber + 1}`
      collection.prevPage = collection.pageNumber === 1 ? null : collection.pageNumber - 1
      collection.prevPageUrl = collection.pageNumber === 1 ? null : `${collection.name}/${collection.pageNumber - 1}`
      if (collection.prevPage === 1) {
        collection.prevPageUrl = collection.name
      }

      const markupOut = path.join(process.cwd(), markupOutDir, collection.pageUrl, 'index.html')
      const fromPath = path.join(process.cwd(), markupOutDir)
      const markupOutDirFull = path.dirname(markupOut)

      mkDir(markupOutDirFull)

      const context = {
        ...collectionData,
        relativePathPrefix: getRelativePathPrefix(markupOutDirFull, fromPath),
        _url: getPageUrl(markupOut)
      }

      if (!file) {
        continue
      }

      const compilePromise = compileEntryFn(file, context).then(({ result }) => {
        fs.writeFileSync(markupOut, result)
      })
      compilePromises.push(compilePromise)
    }
  }

  return compilePromises
}
