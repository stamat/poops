import { pathExists, pathIsDirectory, readDataFile, mkDir, parseFrontMatter, clearFrontMatterCache, buildTime } from './utils/helpers.js'
import { replaceOutExtensions, getRelativePathPrefix, getPageUrl, getPageUrlRelativeToOutput } from './markup/helpers.js'
import { registerFilters } from './markup/filters.js'
import { ImageExtension, GoogleFontsExtension, HighlightExtension } from './markup/extensions.js'
import { collectionAutoDiscovery, getCollectionDataBasedOnConfig, buildCollectionPaginationData, generateCollectionPaginationPages } from './markup/collections.js'
import { generateIndexFiles } from './markup/indexer.js'
import fs from 'node:fs'
import { globSync } from 'glob'
import { highlightRenderer } from './markup/highlight.js'
import { Marked } from 'marked'
import nunjucks from 'nunjucks'
import path from 'node:path'
import log from './utils/log.js'

const marked = new Marked({ renderer: highlightRenderer })
const INDEXABLE_EXTENSIONS = new Set(['.html', '.md', '.njk'])
const MARKUP_EXTENSIONS = 'html|xml|rss|atom|json|njk|md'

class RelativeLoader extends nunjucks.Loader {
  constructor(templatesDir, includePaths) {
    super()
    this.templatesDir = templatesDir
    this.includePaths = includePaths || []
    this.includePaths.push('_*') // XXX: It is better to define templates and layouts directories in the config file? then all together include paths?
  }

  getSource(name) {
    let fullPath = name
    if (!fs.existsSync(name)) {
      let pattern = `**/${name}`
      if (this.includePaths) {
        pattern = `{${this.includePaths.join(',')}}/${pattern}`
      }
      fullPath = globSync(path.join(this.templatesDir, pattern))[0]
    }
    if (!fs.existsSync(fullPath)) {
      log({ tag: 'markup', error: true, text: 'Template not found:', link: name })
      // throw new Error(`Template not found: ${name}`)
      return { src: '', path: fullPath, noCache: true }
    }

    let source = ''
    let frontMatter = {}

    try {
      const frontMatterResult = parseFrontMatter(fullPath)
      frontMatter = frontMatterResult.frontMatter
      source = frontMatterResult.content
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: fullPath })
      console.error(err)
    }

    if (path.extname(fullPath) === '.md') {
      source = marked.parse(source)
    }

    if (frontMatter.layout) {
      source = `{% extends '${frontMatter.layout}.html' %}\n{% block content %}\n${source}\n{% endblock %}`
    }

    return { src: source, path: fullPath, noCache: true }
  }

  resolve(from, to) {
    return path.resolve(path.dirname(from), to)
  }
}

export default class Markups {
  constructor(config) {
    this.config = config
    if (!this.config.markup || !this.config.markup.in) return
    if (!this.config.markup.options) this.config.markup.options = {}

    // Normalize config — resolve dual-path lookups once
    this.markupIn = this.config.markup.in
    this.markupOut = this.config.markup.out || process.cwd()
    this.siteData = this.config.markup.site || this.config.markup.options.site || {}
    this.timeDateFormat = this.config.markup.options.timeDateFormat || this.config.markup.timeDateFormat
    this.collectionsConfig = this.config.markup.options.collections || this.config.markup.collections
    this.includePaths = this.config.markup.includePaths || this.config.markup.options.includePaths || []
    this.autoescape = this.config.markup.autoescape || this.config.markup.options.autoescape || false
    this.searchIndexConfig = this.config.markup.options.searchIndex || this.config.markup.searchIndex
    this.sitemapConfig = this.config.markup.options.sitemap || this.config.markup.sitemap
    this.dataFiles = []

    const options = {
      autoescape: this.autoescape,
      watch: false,
      noCache: true
    }

    this.nunjucksEnv = new nunjucks.Environment(new RelativeLoader(path.join(process.cwd(), this.markupIn), this.includePaths), options)

    registerFilters(this.nunjucksEnv, { timeDateFormat: this.timeDateFormat, markupOut: this.markupOut })

    this.nunjucksEnv.addExtension('ImageExtension', new ImageExtension(() => {
      return path.join(process.cwd(), this.markupOut)
    }))

    this.nunjucksEnv.addExtension('GoogleFontsExtension', new GoogleFontsExtension())
    this.nunjucksEnv.addExtension('HighlightExtension', new HighlightExtension())

    // Load global variables

    const pkgPath = path.join(process.cwd(), 'package.json')

    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      this.nunjucksEnv.addGlobal('package', pkg)
    }

    this.nunjucksEnv.addGlobal('site', this.siteData)

    if (this.config.livereload_port) {
      this.nunjucksEnv.addGlobal('livereload_port', this.config.livereload_port)
    }

    if (this.config.reactorData) {
      for (const [name, html] of Object.entries(this.config.reactorData)) {
        this.nunjucksEnv.addGlobal(name, html)
      }
    }

    const data = this.config.markup.data || this.config.markup.options.data
    this.loadDataFiles(data)

    if (!this.config.markup.out) {
      this.config.markup.out = this.markupOut
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

        this.nunjucksEnv.addGlobal(globalKeyName, data)
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

    markupDefaultExcludes.push('_*') // Ignore directories starting with underscore

    markupDefaultExcludes = [...new Set(markupDefaultExcludes)] // Remove duplicates

    return `!(${markupDefaultExcludes.join('|')})/**/*.+(${MARKUP_EXTENSIONS})`
  }

  compileEntry(templateName, additionalContext) {
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
    } catch (err) {
      log({ tag: 'error', text: 'Failed parsing front matter:', link: templateName })
      console.error(err)
    }

    if (pageUrl) context.page.url = pageUrl

    const env = this.nunjucksEnv
    const frontMatter = context.page

    if (frontMatter && frontMatter.published === false) {
      return Promise.resolve({ result: '', frontMatter, skipped: true })
    }

    return new Promise((resolve, reject) => {
      env.getTemplate(templateName).render(context, (error, result) => {
        if (!error) {
          resolve({ result, frontMatter })
        } else {
          reject(error)
        }
      })
    })
  }

  async compileDirectory(markupIn, collectionData, pageEntries) {
    const markupStart = performance.now()
    const markupFiles = [...globSync(path.join(markupIn, this.generateMarkupGlobPattern(this.includePaths))), ...globSync(path.join(markupIn, `*.+(${MARKUP_EXTENSIONS})`))]
    const compilePromises = []

    for (const file of markupFiles) {
      const relativePath = path.relative(markupIn, file)
      const relativePathParts = relativePath.split(path.sep)

      // Collection pages already generated, skip them
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
            log({ tag: 'markup', text: 'Removed unpublished:', link: path.relative(process.cwd(), outFile) })
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
      log({ tag: 'markup', text: `Compiled: ${markupFiles.length} file${markupFiles.length > 1 ? 's' : ''} into`, link: this.markupOut, time: buildTime(markupStart, markupEnd) })
    } catch (err) {
      log({ tag: 'markup', error: true, text: 'Failed compiling' })
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
          log({ tag: 'markup', text: 'Removed unpublished:', link: path.relative(process.cwd(), markupOut) })
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
      log({ tag: 'markup', text: 'Compiled:', link: path.relative(process.cwd(), path.join(process.cwd(), this.markupOut, path.basename(markupIn))), time: buildTime(markupStart, markupEnd) })
    } catch (err) {
      log({ tag: 'markup', error: true, text: 'Failed compiling:', link: path.relative(process.cwd(), path.join(process.cwd(), this.markupOut, path.basename(markupIn))) })
      console.error(err)
      throw err
    } finally {
      clearFrontMatterCache()
    }
  }

  async compile() {
    if (!this.config.markup || !this.config.markup.in) return

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

    // Create collection pages
    buildCollectionPaginationData(collectionData)
    const collectionPromises = generateCollectionPaginationPages(collectionData, this.markupIn, this.markupOut, this.compileEntry.bind(this))

    await Promise.all(collectionPromises)

    // Collect collection index/pagination page entries for sitemap
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
