import { pathExists, pathIsDirectory, readDataFile, mkDir, buildTime } from './utils/helpers.js'
import { replaceOutExtensions, getRelativePathPrefix, getPageUrl, getPageUrlRelativeToOutput, parseFrontMatter, clearFrontMatterCache, wordcount } from './markup/helpers.js'
import { collectionAutoDiscovery, getCollectionDataBasedOnConfig, buildCollectionPaginationData, generateCollectionPaginationPages } from './markup/collections.js'
import { generateIndexFiles } from './markup/indexer.js'
import NunjucksEngine from './markup/engines/nunjucks.js'
import LiquidEngine from './markup/engines/liquid.js'
import fs from 'node:fs'
import { globSync } from 'glob'
import path from 'node:path'
import log from './utils/log.js'

const ENGINES = {
  nunjucks: NunjucksEngine,
  liquid: LiquidEngine
}

export default class Markups {
  constructor(config) {
    this.config = config
    const moduleConfig = this.config.markup

    if (!moduleConfig || !moduleConfig.in) return
    if (!moduleConfig.options) moduleConfig.options = {}

    // Determine engine
    const engineName = moduleConfig.engine || moduleConfig.options.engine || 'nunjucks'
    this.logTag = 'markup'

    // Normalize config
    this.markupIn = moduleConfig.in
    this.markupOut = moduleConfig.out || process.cwd()
    this.siteData = moduleConfig.site || moduleConfig.options.site || {}
    this.timeDateFormat = moduleConfig.options.timeDateFormat || moduleConfig.timeDateFormat
    this.collectionsConfig = moduleConfig.options.collections || moduleConfig.collections
    this.includePaths = moduleConfig.includePaths || moduleConfig.options.includePaths || []
    this.searchIndexConfig = moduleConfig.options.searchIndex || moduleConfig.searchIndex
    this.sitemapConfig = moduleConfig.options.sitemap || moduleConfig.sitemap
    this.baseURL = moduleConfig.baseURL || moduleConfig.options.baseURL || null
    this.dataFiles = []

    // Instantiate engine
    const EngineClass = ENGINES[engineName]
    if (!EngineClass) {
      log({ tag: 'error', text: `Unknown markup engine: ${engineName}` })
      return
    }

    const templatesDir = path.join(process.cwd(), this.markupIn)
    this.engine = new EngineClass(templatesDir, this.includePaths, {
      autoescape: moduleConfig.autoescape || moduleConfig.options.autoescape || false
    })

    this.engine.registerFilters({ timeDateFormat: this.timeDateFormat, markupOut: this.markupOut })
    this.engine.registerTags(() => path.join(process.cwd(), this.markupOut))

    // Load global variables
    const pkgPath = path.join(process.cwd(), 'package.json')
    if (fs.existsSync(pkgPath)) {
      this.engine.setGlobal('package', JSON.parse(fs.readFileSync(pkgPath, 'utf-8')))
    }

    this.engine.setGlobal('site', this.siteData)

    if (this.config.livereload_port) {
      this.engine.setGlobal('livereload_port', this.config.livereload_port)
    }

    if (this.config.reactorData) {
      for (const [name, html] of Object.entries(this.config.reactorData)) {
        this.engine.setGlobal(name, html)
      }
    }

    const data = moduleConfig.data || moduleConfig.options.data
    this.loadDataFiles(data)

    if (!moduleConfig.out) {
      moduleConfig.out = this.markupOut
    }
  }

  loadDataFiles(files) {
    if (!files) return

    if (!Array.isArray(files)) {
      if (typeof files !== 'string') return
      files = [files]
    }

    const dataDir = pathIsDirectory(this.markupIn) ? this.markupIn : path.dirname(this.markupIn)
    const resolved = []
    for (const file of files) {
      const fullPath = path.join(process.cwd(), dataDir, file)
      if (pathIsDirectory(fullPath)) {
        const dirFiles = globSync(path.join(fullPath, '**/*.+(json|yml|yaml)'))
        for (const f of dirFiles) {
          resolved.push(path.relative(path.join(process.cwd(), dataDir), f))
        }
      } else {
        resolved.push(file)
      }
    }

    if (!this.dataFiles.length) this.dataFiles = resolved

    for (const dataFile of resolved) {
      try {
        const data = readDataFile(path.join(process.cwd(), dataDir, dataFile))
        const globalKeyName = path.basename(dataFile, path.extname(dataFile)).replace(/[.\-\s]/g, '_')
        this.engine.setGlobal(globalKeyName, data)
      } catch (err) {
        log({ tag: 'error', text: 'Data file not found:', link: dataFile })
        continue
      }
    }
  }

  reloadDataFiles() {
    this.loadDataFiles(this.dataFiles)
    return Promise.resolve()
  }

  generateMarkupGlobPattern(excludes) {
    let markupDefaultExcludes = ['node_modules', '.git', '.svn', '.hg']

    if (excludes) {
      markupDefaultExcludes.push(...excludes)
    }

    if (this.config.includePaths) {
      markupDefaultExcludes.push(...this.config.includePaths)
    }

    markupDefaultExcludes.push('_*')
    markupDefaultExcludes = [...new Set(markupDefaultExcludes)]

    return `!(${markupDefaultExcludes.join('|')})/**/*.+(${this.engine.markupExtensions})`
  }

  async compileEntry(templateName, additionalContext) {
    const context = { page: {} }
    let pageUrl

    if (additionalContext) {
      if (additionalContext._url) {
        pageUrl = additionalContext._url
        delete additionalContext._url
      }
      Object.assign(context, additionalContext)
    }

    try {
      const frontMatterResult = parseFrontMatter(templateName)
      context.page = frontMatterResult.frontMatter
      context.page.wordcount = wordcount(frontMatterResult.content)
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: templateName })
      console.error(err)
    }

    if (pageUrl) context.page.url = pageUrl

    const frontMatter = context.page

    if (frontMatter && frontMatter.published === false) {
      return { result: '', frontMatter, skipped: true }
    }

    const result = await this.engine.render(templateName, context)
    return { result, frontMatter }
  }

  async compileDirectory(markupIn, collectionData, pageEntries) {
    const markupStart = performance.now()
    const markupFiles = [
      ...globSync(path.join(markupIn, this.generateMarkupGlobPattern(this.includePaths))),
      ...globSync(path.join(markupIn, `*.+(${this.engine.markupExtensions})`))
    ]
    const compilePromises = []
    const indexableExtensions = this.engine.indexableExtensions

    for (const file of markupFiles) {
      const relativePath = path.relative(markupIn, file)
      const relativePathParts = relativePath.split(path.sep)

      if (relativePathParts.length > 1 &&
        collectionData[relativePathParts[0]] &&
        relativePathParts[1].startsWith('index.') && indexableExtensions.has(path.extname(relativePathParts[1])) &&
        collectionData[relativePathParts[0]].items.length > 0) {
        continue
      }

      let markupOut = path.join(process.cwd(), this.markupOut, relativePath)
      const fromPath = path.join(process.cwd(), this.markupOut)
      const markupOutDir = path.dirname(markupOut)

      mkDir(markupOutDir)

      const fileContext = {
        ...collectionData,
        relativePathPrefix: getRelativePathPrefix(markupOutDir, fromPath, this.baseURL),
        _url: getPageUrl(markupOut)
      }

      const shouldIndex = pageEntries && indexableExtensions.has(path.extname(file))
      const fileCollection = relativePathParts.length > 1 && collectionData[relativePathParts[0]]
        ? relativePathParts[0]
        : null

      const compilePromise = this.compileEntry(file, fileContext).then(({ result, frontMatter, skipped }) => {
        if (skipped) {
          const outFile = replaceOutExtensions(markupOut)
          if (fs.existsSync(outFile)) {
            fs.unlinkSync(outFile)
            log({ tag: this.logTag, text: 'Removed unpublished:', link: path.relative(process.cwd(), outFile) })
          }
          return
        }
        markupOut = replaceOutExtensions(markupOut)
        fs.writeFileSync(markupOut, result)

        if (shouldIndex && frontMatter.published !== false) {
          if (!frontMatter.title) frontMatter.title = path.basename(file, path.extname(file))
          if (fileCollection && !frontMatter.collection) frontMatter.collection = fileCollection

          pageEntries.push({
            ...frontMatter,
            url: getPageUrlRelativeToOutput(markupOut, this.markupOut),
            content: result,
            isIndex: false
          })
        }
      })
      compilePromises.push(compilePromise)
    }

    try {
      await Promise.all(compilePromises)
      const markupEnd = performance.now()
      log({ tag: this.logTag, text: `Compiled: ${markupFiles.length} file${markupFiles.length > 1 ? 's' : ''} into`, link: this.markupOut, time: buildTime(markupStart, markupEnd) })
    } catch (err) {
      log({ tag: this.logTag, error: true, text: 'Failed compiling' })
      console.error(err)
      throw err
    } finally {
      clearFrontMatterCache()
    }
  }

  async compileSingleFile(markupIn, collectionData, pageEntries) {
    const markupStart = performance.now()
    let markupOut = path.join(process.cwd(), this.markupOut)
    const markupOutDir = path.dirname(markupOut)
    const indexableExtensions = this.engine.indexableExtensions
    mkDir(markupOutDir)

    const fileContext = {
      ...collectionData,
      relativePathPrefix: getRelativePathPrefix(markupOutDir, null, this.baseURL),
      _url: getPageUrl(markupOut)
    }

    const shouldIndex = pageEntries && indexableExtensions.has(path.extname(markupIn))

    try {
      const { result, frontMatter, skipped } = await this.compileEntry(markupIn, fileContext)
      markupOut = replaceOutExtensions(markupOut)

      if (skipped) {
        if (fs.existsSync(markupOut)) {
          fs.unlinkSync(markupOut)
          log({ tag: this.logTag, text: 'Removed unpublished:', link: path.relative(process.cwd(), markupOut) })
        }
        return
      }

      fs.writeFileSync(markupOut, result)

      if (shouldIndex && frontMatter.published !== false) {
        if (!frontMatter.title) frontMatter.title = path.basename(markupIn, path.extname(markupIn))
        pageEntries.push({
          ...frontMatter,
          url: getPageUrlRelativeToOutput(markupOut, this.markupOut),
          content: result,
          isIndex: false
        })
      }

      const markupEnd = performance.now()
      log({ tag: this.logTag, text: 'Compiled:', link: path.relative(process.cwd(), path.join(process.cwd(), this.markupOut, path.basename(markupIn))), time: buildTime(markupStart, markupEnd) })
    } catch (err) {
      log({ tag: this.logTag, error: true, text: 'Failed compiling:', link: path.relative(process.cwd(), path.join(process.cwd(), this.markupOut, path.basename(markupIn))) })
      console.error(err)
      throw err
    } finally {
      clearFrontMatterCache()
    }
  }

  async compile() {
    const moduleConfig = this.config.markup
    if (!moduleConfig || !moduleConfig.in) return

    if (this.config.reactorData) {
      for (const [name, html] of Object.entries(this.config.reactorData)) {
        this.engine.setGlobal(name, html)
      }
    }

    const markupIn = path.join(process.cwd(), this.markupIn)

    if (!pathExists(markupIn)) {
      log({ tag: 'error', text: 'Markup path does not exist:', link: markupIn })
      return
    }

    const collectionData = {
      ...collectionAutoDiscovery(this.markupIn),
      ...getCollectionDataBasedOnConfig(this.markupIn, this.collectionsConfig)
    }

    const shouldIndex = this.searchIndexConfig || this.sitemapConfig
    const pageEntries = shouldIndex ? [] : null

    buildCollectionPaginationData(collectionData)
    const collectionPromises = generateCollectionPaginationPages(collectionData, this.markupIn, this.markupOut, this.compileEntry.bind(this), this.baseURL)

    await Promise.all(collectionPromises)

    if (pageEntries) {
      for (const collectionName of Object.keys(collectionData)) {
        const collection = collectionData[collectionName]
        const totalPages = collection.totalPages || 1

        for (let i = 0; i < totalPages; i++) {
          const pageUrl = i === 0 ? collectionName : `${collectionName}/${i + 1}`
          pageEntries.push({
            url: pageUrl,
            title: collectionName,
            isIndex: true
          })
        }
      }
    }

    if (pathIsDirectory(markupIn)) {
      await this.compileDirectory(markupIn, collectionData, pageEntries)
    } else {
      await this.compileSingleFile(markupIn, collectionData, pageEntries)
    }

    if (shouldIndex && pageEntries) {
      generateIndexFiles(pageEntries, this.markupOut, this.siteData.url, {
        searchIndex: this.searchIndexConfig,
        sitemap: this.sitemapConfig
      })
    }
  }
}
