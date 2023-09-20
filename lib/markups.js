const helpers = require('./utils/helpers.js')
const fs = require('node:fs')
const glob = require('glob')
const nunjucks = require('nunjucks')
const path = require('node:path')
const PrintStyle = require('./utils/print-style.js')

const { pathExists, pathIsDirectory, readDataFile } = helpers
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
      options.autoescape = this.config.markup.autoescape
    }

    this.nunjucksEnv = new nunjucks.Environment(new RelativeLoader(path.join(process.cwd(), this.config.markup.in), this.includePaths), options)

    // Add custom filters
    this.nunjucksEnv.addFilter('slugify', str => {
      return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    })

    this.nunjucksEnv.addFilter('jsonify', obj => {
      return JSON.stringify(obj)
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

    return `!(${markupDefaultExcludes.join('|')})/**/*.+(html|njk)`
  }

  compileEntry(templateName) {
    const source = fs.readFileSync(templateName, 'utf-8')
    const match = source.match(/^\s*---\s*([\s\S]*?)---\s*/) // Front matter match
    const context = { page: {} }
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
      const compilePromises = []
      markupFiles.forEach((file) => {
        let markupOut = path.join(process.cwd(), path.relative(this.config.markup.in, file))
        const markupOutDir = path.dirname(markupOut)

        if (!pathExists(markupOutDir)) {
          fs.mkdirSync(markupOutDir, { recursive: true })
        }

        const compilePromise = this.compileEntry(file).then((result) => {
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
      return this.compileEntry(markupIn).then((result) => {
        let markupOut = path.join(process.cwd(), this.config.markup.out)
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
