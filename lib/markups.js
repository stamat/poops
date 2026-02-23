import { pathExists, pathIsDirectory, readDataFile, deleteDirectory, mkDir, parseFrontMatter, clearFrontMatterCache } from './utils/helpers.js'
import fs from 'node:fs'
import { globSync } from 'glob'
import { parse as parseMarkdown } from 'marked'
import moment from 'moment'
import nunjucks from 'nunjucks'
import path from 'node:path'
import PrintStyle from './utils/print-style.js'
import yaml from 'yaml'

const pstyle = new PrintStyle()

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
      console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Template not found:${pstyle.reset} ${pstyle.italic + pstyle.underline}${name}${pstyle.reset}`)
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
      console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${fullPath}${pstyle.reset}`)
      console.log(err)
    }

    if (path.extname(fullPath) === '.md') {
      source = parseMarkdown(source)
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
    this.dataFiles = []
    this.includePaths = this.config.markup.includePaths || this.config.markup.options.includePaths || []

    const options = {
      autoescape: false,
      watch: false,
      noCache: true
    }

    if (this.config.markup.autoescape) {
      options.autoescape = this.config.markup.autoescape || this.config.markup.options.autoescape
    }

    this.nunjucksEnv = new nunjucks.Environment(new RelativeLoader(path.join(process.cwd(), this.config.markup.in), this.includePaths), options)

    // Add custom filters
    this.nunjucksEnv.addFilter('slugify', str => {
      return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    })

    this.nunjucksEnv.addFilter('jsonify', obj => {
      return JSON.stringify(obj)
    })

    this.nunjucksEnv.addFilter('markdown', str => {
      return parseMarkdown(str)
    })

    this.nunjucksEnv.addFilter('date', (str, template) => {
      if (!template) template = this.config.markup.options.timeDateFormat || this.config.markup.timeDateFormat
      if (!template) return str
      const date = !str || str.trim() === '' ? new Date() : new Date(str)
      return moment(date).format(template)
    })

    // Load global variables

    const pkgPath = path.join(process.cwd(), 'package.json')

    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      this.nunjucksEnv.addGlobal('package', pkg)
    }

    const siteData = this.config.markup.site || this.config.markup.options.site || {}
    this.nunjucksEnv.addGlobal('site', siteData)

    if (this.config.livereload_port) {
      this.nunjucksEnv.addGlobal('livereload_port', this.config.livereload_port)
    }

    if (this.config.ssgData) {
      for (const [name, html] of Object.entries(this.config.ssgData)) {
        this.nunjucksEnv.addGlobal(name, html)
      }
    }

    const data = this.config.markup.data || this.config.markup.options.data
    this.loadDataFiles(data)

    if (!this.config.markup.out) {
      this.config.markup.out = process.cwd()
    }
  }

  loadDataFiles(files) {
    if (!files) return

    if (!Array.isArray(files)) {
      if (typeof files !== 'string') return
      files = [files]
    }

    const promises = []

    // TODO: GLOB all files if it's a directory path

    if (!this.dataFiles.length) this.dataFiles = files

    for (const dataFile of files) {
      try {
        const dataDir = pathIsDirectory(this.config.markup.in) ? this.config.markup.in : path.dirname(this.config.markup.in)
        const data = readDataFile(path.join(process.cwd(), dataDir, dataFile))
        const globalKeyName = path.basename(dataFile, path.extname(dataFile)).replace(/[.\-\s]/g, '_')

        promises.push(this.nunjucksEnv.addGlobal(globalKeyName, data))
      } catch (err) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Data file not found:${pstyle.reset} ${pstyle.italic + pstyle.underline}${dataFile}${pstyle.reset}`)
        continue
      }
    }

    return Promise.all(promises)
  }

  reloadDataFiles() {
    return this.loadDataFiles(this.dataFiles)
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

    return `!(${markupDefaultExcludes.join('|')})/**/*.+(html|xml|rss|atom|json|njk|md)`
  }

  getFrontMatter(file, fileName) {
    const source = fileName ? file : fs.readFileSync(file, 'utf-8')
    if (!fileName) fileName = file

    const match = source.match(/^\s*---\s*([\s\S]*?)---\s*/) // Front matter match
    let frontMatter = {}

    if (match) {
      try {
        frontMatter = yaml.parse(match[1]) // Pass front matter to the template
      } catch (err) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${fileName}${pstyle.reset}`)
        console.log(err)
      }
    }

    return frontMatter
  }

  getSingleCollectionData(collectionName) {
    const collectionData = []
    globSync(path.join(process.cwd(), this.config.markup.in, collectionName, '**/*.+(html|njk|md)'), { ignore: ['**/index.+(html|njk|md)'] }).forEach((file) => {
      let frontMatter = {}

      try {
        const frontMatterResult = parseFrontMatter(file)
        frontMatter = frontMatterResult.frontMatter
      } catch (err) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${file}${pstyle.reset}`)
        console.log(err)
      }

      if (frontMatter.published === false) return // Skip unpublished items

      if (!frontMatter.date) {
        frontMatter.date = fs.statSync(file).ctime.toISOString().slice(0, 16)
      }
      frontMatter.fileName = path.basename(file)
      frontMatter.filePath = path.relative(process.cwd(), file)
      frontMatter.collection = collectionName
      frontMatter.url = path.join(collectionName, path.basename(frontMatter.filePath))

      frontMatter.url = this.replaceOutExtensions(frontMatter.url)

      if (!frontMatter.title) {
        frontMatter.title = path.basename(frontMatter.filePath, path.extname(frontMatter.filePath))
      }
      collectionData.push(frontMatter)
    })

    return collectionData
  }

  collectionAutoDiscovery() {
    const indexFiles = globSync(path.join(process.cwd(), this.config.markup.in, '/**/index.+(html|njk|md)'))

    const collectionData = {}

    for (const indexFile of indexFiles) {
      let frontMatter = {}

      try {
        const frontMatterResult = parseFrontMatter(indexFile)
        frontMatter = frontMatterResult.frontMatter
      } catch (err) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${indexFile}${pstyle.reset}`)
        console.log(err)
      }

      if (!frontMatter.collection) continue

      if (frontMatter.collection === true) {
        frontMatter.collection = path.basename(path.dirname(indexFile))
      }

      const collectionName = frontMatter.collection.trim()

      if (collectionName === '') continue

      frontMatter.name = collectionName
      const collection = this.buildCollectionObject(frontMatter)
      if (!collection) continue
      collectionData[collection.name] = collection
    }

    return collectionData
  }

  getCollectionDataBasedOnConfig(collectionConfig) {
    if (!collectionConfig) return {}

    const items = Array.isArray(collectionConfig)
      ? collectionConfig
      : [collectionConfig]

    const collectionData = {}

    for (let item of items) {
      if (typeof item === 'string') item = { name: item }
      if (!item || !item.name) continue
      const collection = this.buildCollectionObject(item)
      if (collection) collectionData[item.name] = collection
    }

    return collectionData
  }

  buildCollectionObject(collectionProtoObject) {
    const collection = {
      name: collectionProtoObject.name,
      items: this.getSingleCollectionData(collectionProtoObject.name)
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
        if (collection.sort.order === 'asc') {
          return a[collection.sort.by] > b[collection.sort.by] ? 1 : -1
        }

        return a[collection.sort.by] < b[collection.sort.by] ? 1 : -1
      }
    })

    return collection
  }

  clearCollectionOutputDir(collectionName) {
    const collectionDirectoryPath = path.join(process.cwd(), this.config.markup.out, collectionName)
    deleteDirectory(collectionDirectoryPath) // Remove collection directory
  }

  getRelativePathPrefix(outputDir, fromDir) {
    let relativeDir = path.relative(process.cwd(), outputDir)
    const fromRelativeDir = fromDir ? path.relative(process.cwd(), fromDir) : ''

    if (fromRelativeDir && relativeDir.startsWith(fromRelativeDir)) {
      relativeDir = relativeDir.replace(fromRelativeDir, '')
    }

    return this.getUpDirPrefix(relativeDir)
  }

  getUpDirPrefix(relativeDir) {
    if (relativeDir.trim() === '') return ''
    if (relativeDir.startsWith(path.sep)) relativeDir = relativeDir.slice(1)
    if (relativeDir.endsWith(path.sep)) relativeDir = relativeDir.slice(0, -1)
    const relativePathParts = relativeDir.split(path.sep)
    let upDir = ''
    for (let i = 0; i < relativePathParts.length; i++) {
      upDir += `..${path.sep}`
    }
    return upDir
  }

  getPageUrl(outputPath) {
    outputPath = this.replaceOutExtensions(outputPath)
    return /index\.[a-z]+$/.test(path.basename(outputPath)) ? path.relative(process.cwd(), path.dirname(outputPath)) : path.relative(process.cwd(), outputPath)
  }

  replaceOutExtensions(outputPath) {
    switch (path.extname(outputPath)) {
      case '.md':
        outputPath = outputPath.replace(/\.md$/, '.html')
        break
      case '.njk':
        outputPath = outputPath.replace(/\.njk$/, '.html')
        break
    }

    return outputPath
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
      console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${templateName}${pstyle.reset}`)
      console.log(err)
    }

    if (pageUrl) context.page.url = pageUrl

    const env = this.nunjucksEnv
    return new Promise((resolve, reject) => {
      env.getTemplate(templateName).render(context, (error, result) => {
        if (!error) {
          resolve(result)
        } else {
          reject(error)
        }
      })
    })
  }

  getCollectionIndexFile(collectionName) {
    const indexFiles = globSync(path.join(process.cwd(), this.config.markup.in, collectionName, 'index.+(html|njk|md)'))
    if (indexFiles.length === 0) return null
    return indexFiles[0]
  }

  buildCollectionPaginationData(collectionData) {
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

  generateCollectionPaginationPages(collectionData, compilePromises) {
    if (!collectionData) return

    for (const collectionName of Object.keys(collectionData)) {
      const collection = collectionData[collectionName]
      const file = this.getCollectionIndexFile(collectionName)

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

        const markupOut = path.join(process.cwd(), this.config.markup.out, collection.pageUrl, 'index.html')
        const fromPath = path.join(process.cwd(), this.config.markup.out)
        const markupOutDir = path.dirname(markupOut)

        mkDir(markupOutDir)

        collectionData.relativePathPrefix = this.getRelativePathPrefix(markupOutDir, fromPath)
        collectionData._url = this.getPageUrl(markupOut)

        if (!file) {
          continue
        }

        const compilePromise = this.compileEntry(file, collectionData).then((result) => {
          fs.writeFileSync(markupOut, result)
        })
        compilePromises.push(compilePromise)
      }
    }
  }

  compile() {
    if (!this.config.markup || !this.config.markup.in) return

    if (this.config.ssgData) {
      for (const [name, html] of Object.entries(this.config.ssgData)) {
        this.nunjucksEnv.addGlobal(name, html)
      }
    }

    const markupIn = path.join(process.cwd(), this.config.markup.in)
    const compilePromises = []

    if (!pathExists(markupIn)) {
      console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Markup path does not exist:${pstyle.reset} ${pstyle.italic + pstyle.underline}${markupIn}${pstyle.reset}`)
      return
    }

    const collectionData = {
      ...this.collectionAutoDiscovery(),
      ...this.getCollectionDataBasedOnConfig(this.config.markup.options.collections)
    }

    // Create collection pages
    this.buildCollectionPaginationData(collectionData)
    this.generateCollectionPaginationPages(collectionData, compilePromises)

    if (pathIsDirectory(markupIn)) {
      const markupFiles = [...globSync(path.join(markupIn, this.generateMarkupGlobPattern(this.includePaths))), ...globSync(path.join(markupIn, '*.+(html|xml|rss|atom|json|njk|md)'))]

      markupFiles.forEach((file) => {
        const relativePath = path.relative(markupIn, file)
        const relativePathParts = relativePath.split(path.sep)

        // Collection pages already generated, skip them
        if (relativePathParts.length > 1 &&
          collectionData[relativePathParts[0]] &&
          /^index\.(html|njk|md)$/.test(relativePathParts[1]) &&
          collectionData[relativePathParts[0]].items.length > 0) {
          return
        }

        let markupOut = path.join(process.cwd(), this.config.markup.out, relativePath)
        const fromPath = path.join(process.cwd(), this.config.markup.out)
        const markupOutDir = path.dirname(markupOut)

        mkDir(markupOutDir)

        collectionData.relativePathPrefix = this.getRelativePathPrefix(markupOutDir, fromPath)
        collectionData._url = this.getPageUrl(markupOut)

        const compilePromise = this.compileEntry(file, collectionData).then((result) => {
          markupOut = this.replaceOutExtensions(markupOut)
          fs.writeFileSync(markupOut, result)
        })
        compilePromises.push(compilePromise)
      })

      return new Promise((resolve, reject) => {
        Promise.all(compilePromises).then(() => {
          console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.dim}Compiled: ${pstyle.reset}${markupFiles.length} file${markupFiles.length > 1 ? 's' : ''} into ${pstyle.italic + pstyle.underline}${this.config.markup.out}${pstyle.reset}`)
          clearFrontMatterCache()
          resolve()
        }).catch((err) => {
          console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Failed compiling${pstyle.reset + pstyle.bell}`)
          console.log(err)
          clearFrontMatterCache()
          reject(err)
        })
      })
    } else {
      let markupOut = path.join(process.cwd(), this.config.markup.out)
      const markupOutDir = path.dirname(markupOut)
      mkDir(markupOutDir)

      collectionData.relativePathPrefix = this.getRelativePathPrefix(markupOutDir)
      collectionData._url = this.getPageUrl(markupOut)

      return this.compileEntry(markupIn, collectionData).then((result) => {
        markupOut = this.replaceOutExtensions(markupOut)
        fs.writeFileSync(markupOut, result)
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${path.relative(process.cwd(), path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)))}${pstyle.reset}`)
        clearFrontMatterCache()
      }).catch((err) => {
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${path.relative(process.cwd(), path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)))}${pstyle.reset + pstyle.bell}`)
        console.log(err)
        clearFrontMatterCache()
      })
    }
  }
}
