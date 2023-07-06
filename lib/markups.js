const helpers = require('./utils/helpers.js')
const fs = require('node:fs')
const glob = require('glob')
const nunjucks = require('nunjucks')
const path = require('node:path')
const PrintStyle = require('./utils/print-style.js')

const { pathExists, pathIsDirectory } = helpers
const pstyle = new PrintStyle()

class RelativeLoader extends nunjucks.Loader {
  constructor(templatesDir, includePaths) {
    super()
    this.templatesDir = templatesDir
    this.includePaths = includePaths || []
    this.includePaths.push('_*')
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

    if (!this.config.markup || !this.config.markup.in) return

    this.nunjucksEnv = new nunjucks.Environment(new RelativeLoader(path.join(process.cwd(), config.markup.in), config.markup.includePaths), {
      autoescape: true,
      watch: false,
      noCache: true
    })

    const pkgPath = path.join(process.cwd(), 'package.json')

    if (fs.existsSync(pkgPath)) {
      const pkg = require(pkgPath)
      this.nunjucksEnv.addGlobal('package', pkg)
    }

    if (this.config.markup.site) {
      this.nunjucksEnv.addGlobal('site', this.config.markup.site)
    }

    if (this.config.markup.data) {
      for (const dataFile of this.config.markup.data) {
        const data = require(path.join(process.cwd(), dataFile))
        // TODO: should support YAML too. There should be a way to define the data file per template through front matter
        this.nunjucksEnv.addGlobal(path.basename(dataFile, path.extname(dataFile)).replace(/[.\-\s]/g, '_'), data)
      }
    }

    this.payload = {} // TODO: still not used. This is where we can store data from data files. Can be used to pass front matter data or even a way to pass data from files to templates

    if (!this.config.markup.out) {
      this.config.markup.out = process.cwd()
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
      console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} Markup path does not exist: ${pstyle.dim}${markupIn}${pstyle.reset}`)
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
