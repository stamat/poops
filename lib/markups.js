const helpers = require('./utils/helpers.js')
const fs = require('node:fs')
const glob = require('glob')
const nunjucks = require('nunjucks')
const path = require('node:path')
const Style = require('./utils/style.js')

const { pathExists, pathIsDirectory } = helpers
const style = new Style()

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

    this.pkg = require(path.join(process.cwd(), 'package.json'))

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
    if (!this.config.markup || !this.config.markup.in) return

    const markupIn = path.join(process.cwd(), this.config.markup.in)

    if (!pathExists(markupIn)) {
      console.log(`${style.redBright + style.bold}[error]${style.reset} Markup path does not exist: ${style.dim}${markupIn}${style.reset}`)
      return
    }

    if (pathIsDirectory(markupIn)) {
      const markupFiles = [...glob.sync(path.join(markupIn, this.generateMarkupGlobPattern(this.config.markup.includePaths))), ...glob.sync(path.join(markupIn, '*.+(html|njk)'))]
      markupFiles.forEach((file) => {
        const markupOut = path.join(process.cwd(), path.relative(this.config.markup.in, file))
        const markupOutDir = path.dirname(markupOut)

        if (!pathExists(markupOutDir)) {
          fs.mkdirSync(markupOutDir, { recursive: true })
        }

        this.compileEntry(file, this.pkg).then((result) => {
          fs.writeFileSync(markupOut, result)
          console.log(`${style.cyanBright + style.bold}[markup]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${path.relative(process.cwd(), markupOut)}${style.reset}`)
        })
      })
    } else {
      this.compileEntry(markupIn, this.pkg).then((result) => {
        fs.writeFileSync(path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)), result)
        console.log(`${style.cyanBright + style.bold}[markup]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${path.relative(process.cwd(), path.join(process.cwd(), this.config.markup.out, path.basename(markupIn)))}${style.reset}`)
      })
    }
  }
}
