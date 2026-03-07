import { pathExists, pathIsDirectory, readDataFile, mkDir, parseFrontMatter, clearFrontMatterCache, buildTime } from './utils/helpers.js'
import { replaceOutExtensions, getRelativePathPrefix, getPageUrl, getPageUrlRelativeToOutput } from './markup/helpers.js'
import { registerFilters } from './liquid/filters.js'
import { registerTags } from './liquid/tags.js'
import { collectionAutoDiscovery, getCollectionDataBasedOnConfig, buildCollectionPaginationData, generateCollectionPaginationPages } from './markup/collections.js'
import { generateIndexFiles } from './markup/indexer.js'
import fs from 'node:fs'
import { globSync } from 'glob'
import { Marked } from 'marked'
import { highlightRenderer } from './markup/highlight.js'
import { Liquid } from 'liquidjs'
import path from 'node:path'
import log from './utils/log.js'

const marked = new Marked({ renderer: highlightRenderer })
const INDEXABLE_EXTENSIONS = new Set(['.html', '.md', '.liquid'])
const MARKUP_EXTENSIONS = 'html|xml|rss|atom|json|liquid|md'

export default class Liquids {
  constructor(config) {
    this.config = config
    if (!this.config.liquid || !this.config.liquid.in) return
    if (!this.config.liquid.options) this.config.liquid.options = {}

    this.markupIn = this.config.liquid.in
    this.markupOut = this.config.liquid.out || process.cwd()
    this.siteData = this.config.liquid.site || this.config.liquid.options.site || {}
    this.timeDateFormat = this.config.liquid.options.timeDateFormat || this.config.liquid.timeDateFormat
    this.collectionsConfig = this.config.liquid.options.collections || this.config.liquid.collections
    this.includePaths = this.config.liquid.includePaths || this.config.liquid.options.includePaths || []
    this.searchIndexConfig = this.config.liquid.options.searchIndex || this.config.liquid.searchIndex
    this.sitemapConfig = this.config.liquid.options.sitemap || this.config.liquid.sitemap
    this.dataFiles = []

    const templatesDir = path.join(process.cwd(), this.markupIn)

    // Build lookup roots for includes/layouts
    const roots = [templatesDir]
    for (const inc of this.includePaths) {
      roots.push(path.join(templatesDir, inc))
    }
    // Also add any _* directories as include roots
    try {
      const entries = fs.readdirSync(templatesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('_')) {
          roots.push(path.join(templatesDir, entry.name))
        }
      }
    } catch { /* ignore */ }

    this.engine = new Liquid({
      root: roots,
      extname: '.liquid',
      cache: false,
      dynamicPartials: true,
      strictFilters: false,
      strictVariables: false,
      jsTruthy: true
    })

    registerFilters(this.engine, { timeDateFormat: this.timeDateFormat, markupOut: this.markupOut })
    registerTags(this.engine, () => path.join(process.cwd(), this.markupOut))

    // Load global variables
    this.globals = {}

    const pkgPath = path.join(process.cwd(), 'package.json')
    if (fs.existsSync(pkgPath)) {
      this.globals.package = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    }

    this.globals.site = this.siteData

    if (this.config.livereload_port) {
      this.globals.livereload_port = this.config.livereload_port
    }

    if (this.config.reactorData) {
      for (const [name, html] of Object.entries(this.config.reactorData)) {
        this.globals[name] = html
      }
    }

    const data = this.config.liquid.data || this.config.liquid.options.data
    this.loadDataFiles(data)

    if (!this.config.liquid.out) {
      this.config.liquid.out = this.markupOut
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
        this.globals[globalKeyName] = data
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

    return `!(${markupDefaultExcludes.join('|')})/**/*.+(${MARKUP_EXTENSIONS})`
  }

  async compileEntry(templateName, additionalContext) {
    const context = { ...this.globals, page: {} }
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
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: templateName })
      console.error(err)
    }

    if (pageUrl) context.page.url = pageUrl

    const frontMatter = context.page

    if (frontMatter && frontMatter.published === false) {
      return { result: '', frontMatter, skipped: true }
    }

    // Get template source with front matter stripped
    let source
    try {
      const frontMatterResult = parseFrontMatter(templateName)
      source = frontMatterResult.content
    } catch (err) {
      log({ tag: 'error', text: 'Failed reading template:', link: templateName })
      console.error(err)
      throw err
    }

    // Handle markdown files
    if (path.extname(templateName) === '.md') {
      source = marked.parse(source)
    }

    // Handle layout wrapping
    if (frontMatter.layout) {
      source = `{% layout '${frontMatter.layout}.liquid' %}{% block content %}${source}{% endblock %}`
    }

    const result = await this.engine.parseAndRender(source, context, {
      globals: this.globals
    })

    return { result, frontMatter }
  }

  async compileDirectory(markupIn, collectionData, pageEntries) {
    const markupStart = performance.now()
    const markupFiles = [...globSync(path.join(markupIn, this.generateMarkupGlobPattern(this.includePaths))), ...globSync(path.join(markupIn, `*.+(${MARKUP_EXTENSIONS})`))]
    const compilePromises = []

    for (const file of markupFiles) {
      const relativePath = path.relative(markupIn, file)
      const relativePathParts = relativePath.split(path.sep)

      if (relativePathParts.length > 1 &&
        collectionData[relativePathParts[0]] &&
        relativePathParts[1].startsWith('index.') && INDEXABLE_EXTENSIONS.has(path.extname(relativePathParts[1])) &&
        collectionData[relativePathParts[0]].items.length > 0) {
        continue
      }

      let markupOut = path.join(process.cwd(), this.markupOut, relativePath)
      const fromPath = path.join(process.cwd(), this.markupOut)
      const markupOutDir = path.dirname(markupOut)

      mkDir(markupOutDir)

      const fileContext = {
        ...collectionData,
        relativePathPrefix: getRelativePathPrefix(markupOutDir, fromPath),
        _url: getPageUrl(markupOut)
      }

      const shouldIndex = pageEntries && INDEXABLE_EXTENSIONS.has(path.extname(file))
      const fileCollection = relativePathParts.length > 1 && collectionData[relativePathParts[0]]
        ? relativePathParts[0]
        : null

      const compilePromise = this.compileEntry(file, fileContext).then(({ result, frontMatter, skipped }) => {
        if (skipped) {
          const outFile = replaceOutExtensions(markupOut)
          if (fs.existsSync(outFile)) {
            fs.unlinkSync(outFile)
            log({ tag: 'liquid', text: 'Removed unpublished:', link: path.relative(process.cwd(), outFile) })
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
      log({ tag: 'liquid', text: `Compiled: ${markupFiles.length} file${markupFiles.length > 1 ? 's' : ''} into`, link: this.markupOut, time: buildTime(markupStart, markupEnd) })
    } catch (err) {
      log({ tag: 'liquid', error: true, text: 'Failed compiling' })
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
    mkDir(markupOutDir)

    const fileContext = {
      ...collectionData,
      relativePathPrefix: getRelativePathPrefix(markupOutDir),
      _url: getPageUrl(markupOut)
    }

    const shouldIndex = pageEntries && INDEXABLE_EXTENSIONS.has(path.extname(markupIn))

    try {
      const { result, frontMatter, skipped } = await this.compileEntry(markupIn, fileContext)
      markupOut = replaceOutExtensions(markupOut)

      if (skipped) {
        if (fs.existsSync(markupOut)) {
          fs.unlinkSync(markupOut)
          log({ tag: 'liquid', text: 'Removed unpublished:', link: path.relative(process.cwd(), markupOut) })
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
      log({ tag: 'liquid', text: 'Compiled:', link: path.relative(process.cwd(), path.join(process.cwd(), this.markupOut, path.basename(markupIn))), time: buildTime(markupStart, markupEnd) })
    } catch (err) {
      log({ tag: 'liquid', error: true, text: 'Failed compiling:', link: path.relative(process.cwd(), path.join(process.cwd(), this.markupOut, path.basename(markupIn))) })
      console.error(err)
      throw err
    } finally {
      clearFrontMatterCache()
    }
  }

  async compile() {
    if (!this.config.liquid || !this.config.liquid.in) return

    if (this.config.reactorData) {
      for (const [name, html] of Object.entries(this.config.reactorData)) {
        this.globals[name] = html
      }
    }

    const markupIn = path.join(process.cwd(), this.markupIn)

    if (!pathExists(markupIn)) {
      log({ tag: 'error', text: 'Liquid path does not exist:', link: markupIn })
      return
    }

    const collectionData = {
      ...collectionAutoDiscovery(this.markupIn),
      ...getCollectionDataBasedOnConfig(this.markupIn, this.collectionsConfig)
    }

    const shouldIndex = this.searchIndexConfig || this.sitemapConfig
    const pageEntries = shouldIndex ? [] : null

    buildCollectionPaginationData(collectionData)
    const collectionPromises = generateCollectionPaginationPages(collectionData, this.markupIn, this.markupOut, this.compileEntry.bind(this))

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
