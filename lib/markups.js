const helpers = require('./utils/helpers.js')
const fs = require('node:fs')
const glob = require('glob')
const nunjucks = require('nunjucks')
const path = require('node:path')
const PrintStyle = require('./utils/print-style.js')

const { pathExists, pathIsDirectory, readDataFile, deleteDirectory } = helpers
const pstyle = new PrintStyle()

class RelativeLoader extends nunjucks.Loader {
  constructor(templatesDir, includePaths) {
    super()
    this.templatesDir = templatesDir
    this.includePaths = includePaths || []
    this.includePaths.push('_*') // XXX: It is better to define templates and layouts directories in the config file? then all toghether include paths?
  }

  getSource(name) {
    let fullPath = name
    if (!fs.existsSync(name)) {
      let pattern = `**/${name}`
      if (this.includePaths) {
        pattern = `{${this.includePaths.join(',')}}/${pattern}`
      }
      fullPath = glob.sync(path.join(this.templatesDir, pattern))[0]
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template not found: ${name}`)
    }

    let source = fs.readFileSync(fullPath, 'utf-8')
    let frontMatter = {}
    const match = source.match(/^\s*---\s*([\s\S]*?)---\s*/)
    if (match) {
      frontMatter = require('yaml').parse(match[1])
      source = source.slice(match[0].length) // Remove front matter
    }

    if (path.extname(fullPath) === '.md') {
      source = require('marked').parse(source)
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

module.exports = class Markups {
  constructor(config) {
    this.config = config
    this.dataFiles = []
    this.includePaths = this.config.markup.includePaths || this.config.markup.options.includePaths || []

    if (!this.config.markup || !this.config.markup.in) return

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
      return require('marked').parse(str)
    })

    // Load global variables

    const pkgPath = path.join(process.cwd(), 'package.json')

    if (fs.existsSync(pkgPath)) {
      const pkg = require(pkgPath)
      this.nunjucksEnv.addGlobal('package', pkg)
    }

    const siteData = this.config.markup.site || this.config.markup.options.site || {}
    this.nunjucksEnv.addGlobal('site', siteData)

    if (this.config.livereload_port) {
      this.nunjucksEnv.addGlobal('livereload_port', this.config.livereload_port)
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

    return `!(${markupDefaultExcludes.join('|')})/**/*.+(html|njk|md)`
  }

  getSingleCollectionData(collectionName) {
    const collectionData = []
    glob.sync(path.join(process.cwd(), this.config.markup.in, collectionName, '**/*.+(html|njk|md)'), { ignore: ['**/index.html'] }).forEach((file) => {
      const source = fs.readFileSync(file, 'utf-8')
      const match = source.match(/^\s*---\s*([\s\S]*?)---\s*/) // Front matter match
      let frontMatter = {}
      if (match) {
        try {
          frontMatter = require('yaml').parse(match[1]) // Pass front matter to the template
        } catch (err) {
          console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${file}${pstyle.reset}`)
          console.log(err)
        }
      }
      if (!frontMatter.date) {
        frontMatter.date = fs.statSync(file).ctime.toISOString().slice(0, 16)
      }
      frontMatter.fileName = path.basename(file)
      frontMatter.filePath = path.relative(process.cwd(), file)
      frontMatter.collection = collectionName
      frontMatter.url = path.join('/', collectionName, path.basename(frontMatter.filePath))
      if (path.extname(frontMatter.filePath) === '.md') {
        frontMatter.url = frontMatter.url.replace(/\.md$/, '.html')
      }
      if (!frontMatter.title) {
        frontMatter.title = path.basename(frontMatter.filePath, path.extname(frontMatter.filePath))
      }
      collectionData.push(frontMatter)
    })

    return collectionData
  }

  getCollectionData(collectionConfig) {
    if (!collectionConfig) return
    const collectionData = {}
    if (!Array.isArray(collectionConfig)) {
      collectionConfig = [collectionConfig]
    }

    for (let collection of collectionConfig) {
      if (typeof collection === 'string') {
        collection = { name: collection }
        collection.sort = 'date'
      }

      const collectionDirectoryPath = path.join(process.cwd(), this.config.markup.out, collection.name)
      deleteDirectory(collectionDirectoryPath) // Remove collection directory

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

      if (!collection.name) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Collection name not specified.${pstyle.reset}`)
        continue
      }

      collectionData[collection.name] = {}
      collectionData[collection.name].items = this.getSingleCollectionData(collection.name)
      collectionData[collection.name].items.sort((a, b) => {
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
    }

    return collectionData
  }

  getRelativePathPrefix(outputDir) {
    const relativeDir = path.relative(process.cwd(), outputDir)
    if (relativeDir.trim() === '') return ''
    const relativePathParts = relativeDir.split(path.sep)
    let relativePathPrefix = ''
    for (let i = 0; i < relativePathParts.length; i++) {
      relativePathPrefix += '../'
    }
    return relativePathPrefix
  }

  compileEntry(templateName, additionalContext) {
    const source = fs.readFileSync(templateName, 'utf-8')
    const match = source.match(/^\s*---\s*([\s\S]*?)---\s*/) // Front matter match
    const context = { page: {} }
    if (additionalContext) {
      Object.assign(context, additionalContext)
    }
    if (match) {
      try {
        context.page = require('yaml').parse(match[1]) // Pass front matter to the template
      } catch (err) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${templateName}${pstyle.reset}`)
        console.log(err)
      }
    }

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

  compile() {
    // TODO: should support multiple markup paths, for loop here!
    if (!this.config.markup || !this.config.markup.in) return

    const markupIn = path.join(process.cwd(), this.config.markup.in)

    if (!pathExists(markupIn)) {
      console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Markup path does not exist:${pstyle.reset} ${pstyle.italic + pstyle.underline}${markupIn}${pstyle.reset}`)
      return
    }

    if (pathIsDirectory(markupIn)) {
      const markupFiles = [...glob.sync(path.join(markupIn, this.generateMarkupGlobPattern(this.includePaths))), ...glob.sync(path.join(markupIn, '*.+(html|njk|md)'))]
      const collectionData = this.getCollectionData(this.config.markup.collections || this.config.markup.options.collections)
      const compilePromises = []
      markupFiles.forEach((file) => {
        const relativePath = path.relative(markupIn, file)
        const relativePathParts = relativePath.split(path.sep)

        // Create pagination for collection pages
        if (relativePathParts.length > 1 &&
          collectionData[relativePathParts[0]] &&
          relativePathParts[1] === 'index.html' &&
          collectionData[relativePathParts[0]].items.length > 0) {
          let frontMatter = {}
          const source = fs.readFileSync(file, 'utf-8')
          const match = source.match(/^\s*---\s*([\s\S]*?)---\s*/) // Front matter match
          if (match) {
            try {
              frontMatter = require('yaml').parse(match[1]) // Pass front matter to the template
            } catch (err) {
              console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}${pstyle.dim} Failed parsing front matter:${pstyle.reset} ${pstyle.italic + pstyle.underline}${file}${pstyle.reset}`)
              console.log(err)
            }
          }

          if (!frontMatter.paginate && !isNaN(parseInt(frontMatter.paginate))) {
            frontMatter.paginate = parseInt(frontMatter.paginate)
          }

          const collectionName = relativePathParts[0]

          if (frontMatter.paginate && collectionData[collectionName].items.length > frontMatter.paginate) {
            const collection = collectionData[collectionName]
            collection.paginate = frontMatter.paginate
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

            for (let i = 0; i < collection.totalPages; i++) {
              collection.pageItems = collection.pages[i]
              collection.pageNumber = i + 1
              collection.pageUrl = collection.pageNumber === 1 ? collectionName : `${collectionName}/${collection.pageNumber}`
              collection.nextPage = collection.pageNumber === collection.totalPages ? null : collection.pageNumber + 1
              collection.nextPageUrl = collection.pageNumber === collection.totalPages ? null : `${collectionName}/${collection.pageNumber + 1}`
              collection.prevPage = collection.pageNumber === 1 ? null : collection.pageNumber - 1
              collection.prevPageUrl = collection.pageNumber === 1 ? null : `${collectionName}/${collection.pageNumber - 1}`
              if (collection.prevPage === 1) {
                collection.prevPageUrl = collectionName
              }

              const markupOut = path.join(process.cwd(), this.config.markup.out, collection.pageUrl, 'index.html')
              const markupOutDir = path.dirname(markupOut)

              if (!pathExists(markupOutDir)) {
                fs.mkdirSync(markupOutDir, { recursive: true })
              }

              collectionData.relativePathPrefix = this.getRelativePathPrefix(markupOutDir)

              const compilePromise = this.compileEntry(file, collectionData).then((result) => {
                fs.writeFileSync(markupOut, result)
              })
              compilePromises.push(compilePromise)
            }
          }

          return
        }

        let markupOut = path.join(process.cwd(), relativePath)
        const markupOutDir = path.dirname(markupOut)

        if (!pathExists(markupOutDir)) {
          fs.mkdirSync(markupOutDir, { recursive: true })
        }

        collectionData.relativePathPrefix = this.getRelativePathPrefix(markupOutDir)

        const compilePromise = this.compileEntry(file, collectionData).then((result) => {
          if (path.extname(markupOut) === '.md') {
            markupOut = markupOut.replace(/\.md$/, '.html')
          }
          fs.writeFileSync(markupOut, result)
        })
        compilePromises.push(compilePromise)
      })

      return new Promise((resolve, reject) => {
        Promise.all(compilePromises).then(() => {
          console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.dim}Compiled: ${pstyle.reset}${markupFiles.length} file${markupFiles.length > 1 ? 's' : ''} into ${pstyle.italic + pstyle.underline}${this.config.markup.out}${pstyle.reset}`)
          resolve()
        }).catch((err) => {
          console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Failed compiling${pstyle.reset + pstyle.bell}`)
          console.log(err)
          reject(err)
        })
      })
    } else {
      let markupOut = path.join(process.cwd(), this.config.markup.out)
      const markupOutDir = path.dirname(markupOut)
      const additionalContext = {}
      additionalContext.relativePathPrefix = this.getRelativePathPrefix(markupOutDir)

      return this.compileEntry(markupIn, additionalContext).then((result) => {
        if (path.extname(markupOut) === '.md') {
          markupOut = markupOut.replace(/\.md$/, '.html')
        }
        fs.writeFileSync(markupOut, result)
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${path.relative(process.cwd(), path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)))}${pstyle.reset}`)
      }).catch((err) => {
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${path.relative(process.cwd(), path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)))}${pstyle.reset + pstyle.bell}`)
        console.log(err)
      })
    }
  }
}
