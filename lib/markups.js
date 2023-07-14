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

    // TODO: Here we can interpret header yaml and pass it as a context, just like Jekyll does
    const source = fs.readFileSync(fullPath, 'utf-8')
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

    if (!this.config.markup || !this.config.markup.in) return

    const options = {
      autoescape: false,
      watch: false,
      noCache: true
    }

    if (this.config.markup.autoescape) {
      options.autoescape = this.config.markup.autoescape
    }

    this.nunjucksEnv = new nunjucks.Environment(new RelativeLoader(path.join(process.cwd(), config.markup.in), config.markup.includePaths), options)

    // Add custom filters
    this.nunjucksEnv.addFilter('slugify', str => {
      return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    })

    // Load global variables

    const pkgPath = path.join(process.cwd(), 'package.json')

    if (fs.existsSync(pkgPath)) {
      const pkg = require(pkgPath)
      this.nunjucksEnv.addGlobal('package', pkg)
    }

    if (this.config.markup.site) {
      this.nunjucksEnv.addGlobal('site', this.config.markup.site)
    }

    this.loadDataFiles(this.config.markup.data)

    this.payload = {} // TODO: still not used. This is where we can store data from data files. Can be used to pass front matter data or even a way to pass data from files to templates

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
        // TODO: should support YAML too. There should be a way to define the data file per template through front matter
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

  compileEntry(templateName, context) {
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
      const markupFiles = [...glob.sync(path.join(markupIn, this.generateMarkupGlobPattern(this.config.markup.includePaths))), ...glob.sync(path.join(markupIn, '*.+(html|njk)'))]
      const compilePromises = []
      markupFiles.forEach((file) => {
        const markupOut = path.join(process.cwd(), path.relative(this.config.markup.in, file))
        const markupOutDir = path.dirname(markupOut)

        if (!pathExists(markupOutDir)) {
          fs.mkdirSync(markupOutDir, { recursive: true })
        }

        const compilePromise = this.compileEntry(file, this.payload).then((result) => {
          fs.writeFileSync(markupOut, result)
        })
        compilePromises.push(compilePromise)
      })

      Promise.all(compilePromises).then(() => {
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.dim}Compiled: ${pstyle.reset}${markupFiles.length} file${markupFiles.length > 1 ? 's' : ''} into ${pstyle.italic + pstyle.underline}${this.config.markup.out}${pstyle.reset}`)
      }).catch((err) => {
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Failed compiling${pstyle.reset + pstyle.bell}`)
        console.log(err)
      })
    } else {
      this.compileEntry(markupIn, this.pkg).then((result) => {
        fs.writeFileSync(path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)), result)
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${path.relative(process.cwd(), path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)))}${pstyle.reset}`)
      }).catch((err) => {
        console.log(`${pstyle.cyanBright + pstyle.bold}[markup]${pstyle.reset} ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${path.relative(process.cwd(), path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)))}${pstyle.reset + pstyle.bell}`)
        console.log(err)
      })
    }
  }
}
