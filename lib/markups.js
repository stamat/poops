import { pathExists, pathIsDirectory, readDataFile, mkDir, buildTime, toPosix } from './utils/helpers.js'
import { replaceOutExtensions, getRelativePathPrefix, getPageUrlRelativeToOutput, parseFrontMatter, wordcount } from './markup/helpers.js'
import { collectionAutoDiscovery, getCollectionDataBasedOnConfig, buildCollectionPaginationData, generateCollectionPaginationPages } from './markup/collections.js'
import { generateIndexFiles, buildNavTree } from './markup/indexer.js'
import NunjucksEngine from './markup/engines/nunjucks.js'
import LiquidEngine from './markup/engines/liquid.js'
import fs from 'node:fs'
import { globSync } from 'glob'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
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

    // Determine engine — resolved in init(), builtin name or importable module
    this.engineName = moduleConfig.engine || moduleConfig.options.engine || 'nunjucks'
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
    this.navConfig = moduleConfig.options.nav || moduleConfig.nav
    this.baseURL = moduleConfig.baseURL || moduleConfig.options.baseURL || null

    this.autoescape = moduleConfig.autoescape || moduleConfig.options.autoescape || false
    this.dataConfig = moduleConfig.data || moduleConfig.options.data

    if (!moduleConfig.out) {
      moduleConfig.out = this.markupOut
    }
  }

  // Engine instantiation is async because non-builtin engines are loaded via
  // dynamic import. Idempotent; compile() calls it lazily, so a failed engine
  // resolution logs once per compile and the module stays inert.
  async init() {
    if (!this.markupIn || this.engine) return

    let EngineClass = ENGINES[this.engineName]
    if (!EngineClass) {
      try {
        // Relative/absolute specifiers resolve against cwd (the user's
        // project), bare specifiers against the module graph (node_modules)
        const spec = /^[./]/.test(this.engineName) || path.isAbsolute(this.engineName)
          ? pathToFileURL(path.resolve(process.cwd(), this.engineName)).href
          : this.engineName
        EngineClass = (await import(spec)).default
      } catch {
        // Bare specifier not reachable from poops's own module graph (e.g.
        // poops installed via a file: link) — resolve from the user's project
        try {
          const projectRequire = createRequire(path.join(process.cwd(), 'package.json'))
          EngineClass = (await import(pathToFileURL(projectRequire.resolve(this.engineName)).href)).default
        } catch { /* handled below */ }
      }
    }

    if (typeof EngineClass !== 'function') {
      log({ tag: 'error', text: `Unknown markup engine: ${this.engineName}` })
      return
    }

    const templatesDir = path.resolve(process.cwd(), this.markupIn)
    this.engine = new EngineClass(templatesDir, this.includePaths, {
      autoescape: this.autoescape
    })

    this.engine.registerFilters({ timeDateFormat: this.timeDateFormat, markupOut: this.markupOut })
    this.engine.registerTags(() => path.resolve(process.cwd(), this.markupOut))

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

    this.loadDataFiles(this.dataConfig)
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
      const fullPath = path.resolve(process.cwd(), dataDir, file)
      if (pathIsDirectory(fullPath)) {
        const dirFiles = globSync(toPosix(path.join(fullPath, '**/*.+(json|yml|yaml)')))
        for (const f of dirFiles) {
          resolved.push(path.relative(path.resolve(process.cwd(), dataDir), f))
        }
      } else {
        resolved.push(file)
      }
    }

    const loadedKeys = new Set()
    for (const dataFile of resolved) {
      try {
        const data = readDataFile(path.resolve(process.cwd(), dataDir, dataFile))
        const globalKeyName = path.basename(dataFile, path.extname(dataFile)).replace(/[.\-\s]/g, '_')
        this.engine.setGlobal(globalKeyName, data)
        loadedKeys.add(globalKeyName)
      } catch (err) {
        log({ tag: 'error', text: 'Data file not found:', link: dataFile })
        continue
      }
    }

    // A deleted data file must also drop its global, or stale data renders forever
    if (this.dataGlobalKeys) {
      for (const key of this.dataGlobalKeys) {
        if (!loadedKeys.has(key)) this.engine.removeGlobal(key)
      }
    }
    this.dataGlobalKeys = loadedKeys
  }

  reloadDataFiles() {
    if (this.engine) this.loadDataFiles(this.dataConfig)
    return Promise.resolve()
  }

  // Engines can override output extension mapping (e.g. a template format
  // whose extension isn't in the default map); falls back to the shared helper
  mapOutputPath(outputPath) {
    if (this.engine && typeof this.engine.replaceOutExtensions === 'function') {
      return this.engine.replaceOutExtensions(outputPath)
    }
    return replaceOutExtensions(outputPath)
  }

  // Maps a deleted source path to its build output and removes it.
  // compile() only globs existing sources, so it can never clean up
  // after a deletion — this is the only place stale output gets removed.
  removeOutput(sourcePath) {
    if (!this.markupIn) return
    const markupIn = path.resolve(process.cwd(), this.markupIn)
    const rel = path.relative(markupIn, path.resolve(process.cwd(), sourcePath))
    if (rel.startsWith('..') || path.isAbsolute(rel)) return

    const mapped = path.resolve(process.cwd(), this.markupOut, rel)

    // rel === '' with a directory output would be the whole out dir —
    // never remove that, it also holds css/js from other modules
    if (rel !== '' && fs.existsSync(mapped) && fs.statSync(mapped).isDirectory()) {
      fs.rmSync(mapped, { recursive: true })
      log({ tag: this.logTag, text: 'Removed:', link: path.relative(process.cwd(), mapped) })
      return
    }

    const outFile = this.mapOutputPath(mapped)
    if (fs.existsSync(outFile) && !fs.statSync(outFile).isDirectory()) {
      fs.unlinkSync(outFile)
      log({ tag: this.logTag, text: 'Removed:', link: path.relative(process.cwd(), outFile) })
    }
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
      context.page.content = frontMatterResult.content
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

  getMarkupFiles(markupIn) {
    // glob patterns must use `/` — on Windows `\` is an escape character
    return [
      ...globSync(toPosix(path.join(markupIn, this.generateMarkupGlobPattern(this.includePaths)))),
      ...globSync(toPosix(path.join(markupIn, `*.+(${this.engine.markupExtensions})`)))
    ]
  }

  // True for collection index templates that compileDirectory skips —
  // pagination renders them instead
  isCollectionIndexOverride(relativePathParts, collectionData) {
    return relativePathParts.length > 1 &&
      collectionData[relativePathParts[0]] &&
      relativePathParts[1].startsWith('index.') &&
      this.engine.indexableExtensions.has(path.extname(relativePathParts[1])) &&
      collectionData[relativePathParts[0]].items.length > 0
  }

  // Pre-pass: builds the nav tree from front matter alone (no rendering) and
  // exposes it as the `nav` template global, so sidebars can render during the
  // same compile instead of reading the previous build's nav.json.
  // parseFrontMatter caches by mtime, so the compile pass re-reads nothing.
  buildNavGlobal(markupIn, collectionData) {
    if (!this.navConfig) return

    const entries = []
    for (const collectionName of Object.keys(collectionData)) {
      entries.push({ url: collectionName, title: collectionName, isIndex: true })
    }

    const files = pathIsDirectory(markupIn) ? this.getMarkupFiles(markupIn) : [markupIn]
    for (const file of files) {
      if (!this.engine.indexableExtensions.has(path.extname(file))) continue
      const relativePath = path.relative(markupIn, file)
      const relativePathParts = relativePath.split(path.sep)
      if (this.isCollectionIndexOverride(relativePathParts, collectionData)) continue

      let frontMatter
      try {
        frontMatter = parseFrontMatter(file).frontMatter
      } catch (err) {
        continue
      }
      if (frontMatter.published === false) continue
      if (!frontMatter.title) frontMatter.title = path.basename(file, path.extname(file))

      const fileCollection = relativePathParts.length > 1 && collectionData[relativePathParts[0]]
        ? relativePathParts[0]
        : null
      if (fileCollection && !frontMatter.collection) frontMatter.collection = fileCollection

      const outPath = this.mapOutputPath(path.resolve(process.cwd(), this.markupOut, relativePath))
      entries.push({
        ...frontMatter,
        url: getPageUrlRelativeToOutput(outPath, this.markupOut),
        isIndex: false
      })
    }

    const navOptions = typeof this.navConfig === 'object' ? this.navConfig : {}
    this.engine.setGlobal('nav', buildNavTree(entries, navOptions))
  }

  // One page: render, write, index. Shared by full directory compiles and
  // incremental rebuilds. Resolves to { skipped, entry } so incremental can
  // patch the previous build's entries.
  compilePage(file, markupIn, collectionData, pageEntries) {
    const relativePath = path.relative(markupIn, file)
    const relativePathParts = relativePath.split(path.sep)

    // Map before deriving dir/prefix: engines may relocate output (e.g.
    // Shopify's templates/ flattening), and links must match the final path.
    const markupOut = this.mapOutputPath(path.resolve(process.cwd(), this.markupOut, relativePath))
    const fromPath = path.resolve(process.cwd(), this.markupOut)
    const markupOutDir = path.dirname(markupOut)

    mkDir(markupOutDir)

    const fileContext = {
      ...collectionData,
      relativePathPrefix: getRelativePathPrefix(markupOutDir, fromPath, this.baseURL),
      // output-relative so page.url matches nav.json urls (getPageUrlRelativeToOutput),
      // otherwise `item.url == page.url` sidebar/active checks never fire
      _url: getPageUrlRelativeToOutput(markupOut, this.markupOut)
    }

    const shouldIndex = pageEntries && this.engine.indexableExtensions.has(path.extname(file))
    const fileCollection = relativePathParts.length > 1 && collectionData[relativePathParts[0]]
      ? relativePathParts[0]
      : null

    return this.compileEntry(file, fileContext).then(({ result, frontMatter, skipped }) => {
      if (skipped) {
        if (fs.existsSync(markupOut)) {
          fs.unlinkSync(markupOut)
          log({ tag: this.logTag, text: 'Removed unpublished:', link: path.relative(process.cwd(), markupOut) })
        }
        return { skipped: true, entry: null }
      }
      // async write so I/O overlaps rendering of the other pages; the
      // returned promise keeps Promise.all waiting for it
      const write = fs.promises.writeFile(markupOut, result)

      let entry = null
      if (shouldIndex && frontMatter.published !== false) {
        if (!frontMatter.title) frontMatter.title = path.basename(file, path.extname(file))
        if (fileCollection && !frontMatter.collection) frontMatter.collection = fileCollection

        entry = {
          ...frontMatter,
          url: getPageUrlRelativeToOutput(markupOut, this.markupOut),
          content: result,
          isIndex: false,
          // source path (normalized) so incremental rebuilds can replace this
          // entry; stripped from emitted artifacts (indexer INTERNAL_FIELDS)
          _src: path.resolve(file)
        }
        pageEntries.push(entry)
      }
      return write.then(() => ({ skipped: false, entry }))
    })
  }

  async compileDirectory(markupIn, collectionData, pageEntries) {
    const markupStart = performance.now()
    const markupFiles = this.getMarkupFiles(markupIn)
    const compilePromises = []

    for (const file of markupFiles) {
      const relativePathParts = path.relative(markupIn, file).split(path.sep)

      if (this.isCollectionIndexOverride(relativePathParts, collectionData)) {
        continue
      }

      compilePromises.push(this.compilePage(file, markupIn, collectionData, pageEntries))
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
      this.clearEngineCaches()
    }
  }

  // Front matter/markdown/data caches are mtime- or identity-validated and
  // survive across compiles — a watch rebuild only re-reads what changed.
  // Engines with per-file invalidation (nunjucks) keep their compiled
  // templates too — the watcher routes changed paths to invalidate(). Engines
  // without it (liquid) still clear their parse cache every compile so
  // watch-mode edits are always picked up.
  clearEngineCaches() {
    if (typeof this.engine.invalidate === 'function') return
    if (typeof this.engine.clearCache === 'function') this.engine.clearCache()
  }

  // Watch-mode hook: drop engine state backed by one changed/deleted file.
  // The mtime-validated caches need no help — this only reaches engines that
  // cache compiled templates across compiles.
  invalidate(file) {
    if (this.engine && typeof this.engine.invalidate === 'function') this.engine.invalidate(file)
  }

  async compileSingleFile(markupIn, collectionData, pageEntries) {
    const markupStart = performance.now()
    let markupOut = path.resolve(process.cwd(), this.markupOut)
    const markupOutDir = path.dirname(markupOut)
    const indexableExtensions = this.engine.indexableExtensions
    mkDir(markupOutDir)

    const fileContext = {
      ...collectionData,
      relativePathPrefix: getRelativePathPrefix(markupOutDir, null, this.baseURL),
      // output-relative so page.url matches nav.json/index urls, same as compileDirectory
      _url: getPageUrlRelativeToOutput(this.mapOutputPath(markupOut), this.markupOut)
    }

    const shouldIndex = pageEntries && indexableExtensions.has(path.extname(markupIn))

    try {
      const { result, frontMatter, skipped } = await this.compileEntry(markupIn, fileContext)
      markupOut = this.mapOutputPath(markupOut)

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
      log({ tag: this.logTag, text: 'Compiled:', link: path.relative(process.cwd(), path.resolve(process.cwd(), this.markupOut, path.basename(markupIn))), time: buildTime(markupStart, markupEnd) })
    } catch (err) {
      log({ tag: this.logTag, error: true, text: 'Failed compiling:', link: path.relative(process.cwd(), path.resolve(process.cwd(), this.markupOut, path.basename(markupIn))) })
      console.error(err)
      throw err
    } finally {
      this.clearEngineCaches()
    }
  }

  async compile() {
    const moduleConfig = this.config.markup
    if (!moduleConfig || !moduleConfig.in) return

    await this.init()
    if (!this.engine) return

    // Reset up front so a failed build can't leave a stale snapshot —
    // compileIncremental treats a missing snapshot as "must full-compile"
    this.lastCollectionData = null
    this.lastPageEntries = null

    if (this.config.reactorData) {
      // A removed reactor component must also drop its injected global,
      // same staleness rule as data files in loadDataFiles()
      const reactorKeys = new Set(Object.keys(this.config.reactorData))
      if (this.reactorGlobalKeys) {
        for (const key of this.reactorGlobalKeys) {
          if (!reactorKeys.has(key)) this.engine.removeGlobal(key)
        }
      }
      this.reactorGlobalKeys = reactorKeys

      for (const [name, html] of Object.entries(this.config.reactorData)) {
        this.engine.setGlobal(name, html)
      }
    }

    const markupIn = path.resolve(process.cwd(), this.markupIn)

    if (!pathExists(markupIn)) {
      log({ tag: 'error', text: 'Markup path does not exist:', link: markupIn })
      return
    }

    const collectionData = {
      ...collectionAutoDiscovery(this.markupIn),
      ...getCollectionDataBasedOnConfig(this.markupIn, this.collectionsConfig)
    }

    const shouldIndex = this.searchIndexConfig || this.sitemapConfig || this.navConfig
    const pageEntries = shouldIndex ? [] : null

    buildCollectionPaginationData(collectionData)

    // must precede any rendering (incl. pagination pages) so every template
    // sees the current build's nav
    this.buildNavGlobal(markupIn, collectionData)

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
        sitemap: this.sitemapConfig,
        nav: this.navConfig
      })
    }

    // Snapshot for incremental rebuilds: they render with the same
    // collection/pagination context and patch these entries in place
    this.lastCollectionData = collectionData
    this.lastPageEntries = pageEntries
  }

  // Watch hook for .json/.yaml changes. Data extensions are ambiguous: a
  // .json may be a data file feeding the globals, or engine-owned markup
  // (Shopify templates/*.json, section-group JSON). Engines that can tell
  // claim theirs via isMarkupSource() and get the incremental path;
  // everything else reloads data globals and full-compiles, as before.
  async compileDataChange(file) {
    await this.init()
    if (this.engine && typeof this.engine.isMarkupSource === 'function' &&
      this.engine.isMarkupSource(path.resolve(process.cwd(), file))) {
      return this.compileIncremental(file)
    }
    return this.reloadDataFiles().then(() => this.compile())
  }

  // Watch-mode entry point: rebuild only the pages whose last render touched
  // the changed file. Falls back to a full compile() whenever the result
  // isn't provably identical to a full build — unsupported engine, no prior
  // successful full build, deletions/renames, collection membership (listing
  // and pagination pages read item content outside the dep index), an
  // affected pagination-rendered template, a published flip, or front matter
  // drift while a nav global is baked into every page.
  async compileIncremental(changedFile) {
    const moduleConfig = this.config.markup
    if (!moduleConfig || !moduleConfig.in) return

    await this.init()
    if (!this.engine) return

    if (typeof this.engine.pagesDependingOn !== 'function') return this.compile()
    if (!this.lastCollectionData) return this.compile()

    const markupIn = path.resolve(process.cwd(), this.markupIn)
    if (!pathIsDirectory(markupIn)) return this.compile()

    const abs = path.resolve(process.cwd(), changedFile)
    if (!fs.existsSync(abs)) return this.compile()

    // Drop the changed file's compiled template (idempotent — the watcher
    // already does this, but incremental must not depend on that)
    this.invalidate(abs)

    const collectionData = this.lastCollectionData
    const relParts = path.relative(markupIn, abs).split(path.sep)
    if (relParts[0] !== '..' && collectionData[relParts[0]]) return this.compile()

    let affected = this.engine.pagesDependingOn(abs)
    if (affected === null) return this.compile() // dep index unreliable
    affected = affected.filter((page) => fs.existsSync(page))
    if (affected.length === 0) return this.compile() // unknown file — don't guess

    for (const page of affected) {
      const rel = path.relative(markupIn, page)
      if (rel.startsWith('..')) return this.compile()
      if (this.isCollectionIndexOverride(rel.split(path.sep), collectionData)) return this.compile()
    }

    // A page's own dep set always contains itself, so an edited page is in
    // `affected` (exact match, no glob needed). If it isn't, but the file IS a
    // page source, this is a new page whose basename collides with a recorded
    // dep — rendering only the collided pages would leave it unbuilt.
    if (!affected.includes(abs) && this.getMarkupFiles(markupIn).some((f) => path.resolve(f) === abs)) {
      return this.compile()
    }

    const markupStart = performance.now()
    const newEntries = this.lastPageEntries ? [] : null

    let results
    try {
      results = await Promise.all(affected.map((page) => this.compilePage(page, markupIn, collectionData, newEntries)))
    } catch (err) {
      log({ tag: this.logTag, error: true, text: 'Failed compiling' })
      console.error(err)
      throw err
    } finally {
      this.clearEngineCaches()
    }

    // A skipped (published: false) page changes the page set — nav, index and
    // collection listings all shift, only a full build gets them right
    if (results.some((r) => r.skipped)) return this.compile()

    if (this.lastPageEntries) {
      for (const entry of newEntries) {
        const idx = this.lastPageEntries.findIndex((e) => e._src === entry._src)
        if (idx === -1) return this.compile() // page wasn't part of the last full build
        // The nav global is baked into every page's HTML — front matter
        // drift (title, order, …) can change it for pages we're not
        // rebuilding. Content/wordcount change on every edit and never feed
        // the nav, so they're excluded from the comparison.
        if (this.navConfig && entrySignature(this.lastPageEntries[idx]) !== entrySignature(entry)) {
          return this.compile()
        }
        this.lastPageEntries[idx] = entry
      }

      generateIndexFiles(this.lastPageEntries, this.markupOut, this.siteData.url, {
        searchIndex: this.searchIndexConfig,
        sitemap: this.sitemapConfig,
        nav: this.navConfig
      })
    }

    const markupEnd = performance.now()
    log({ tag: this.logTag, text: `Recompiled: ${affected.length} page${affected.length > 1 ? 's' : ''} into`, link: this.markupOut, time: buildTime(markupStart, markupEnd) })
  }
}

// Everything except the fields that change on every content edit — used to
// detect front matter drift that would invalidate the shared nav global
function entrySignature(entry) {
  const { content, wordcount, ...rest } = entry
  return JSON.stringify(rest)
}
