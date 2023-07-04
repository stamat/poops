#!/usr/bin/env node

const chokidar = require('chokidar')
const connect = require('connect')
const helpers = require('./lib/utils/helpers.js')
const fs = require('node:fs')
const glob = require('glob')
const http = require('node:http')
const livereload = require('livereload')
const nunjucks = require('nunjucks')
const path = require('node:path')
const serveStatic = require('serve-static')
const Scripts = require('./lib/scripts.js')
const Style = require('./lib/utils/style.js')
const Styles = require('./lib/styles.js')

const {
  pathExists,
  pathIsDirectory
} = helpers

const cwd = process.cwd() // Current Working Directory
const pkg = require('./package.json')
const args = process.argv.slice(2)

let nunjucksEnv

let defaultConfigPath = 'poops.json'

if (args.length) {
  defaultConfigPath = args[0]
}

const configPath = path.join(cwd, defaultConfigPath)
// Load poops.json
const config = require(configPath)

const style = new Style()

// JS/TS Compiler

// Main function 💩
function poops() {
  if (config.livereload) {
    const lrExcludes = ['.git', '.svn', '.hg']

    if (config.watch) {
      lrExcludes.push(...config.watch)
    }

    if (config.includePaths) {
      lrExcludes.push(...config.includePaths)
    }

    if (config.livereload.exclude) {
      lrExcludes.push(...config.livereload.exclude)
    }

    const lrserver = livereload.createServer({
      exclusions: [...new Set(lrExcludes)],
      port: config.livereload.port || 35729
    })
    console.log(`${style.blue + style.bold}[info]${style.reset} ${style.dim}🔃 LiveReload server:${style.reset} ${style.italic + style.underline}http://localhost:${lrserver.config.port}${style.reset}`)
    lrserver.watch(cwd)
  }

  styles.compile()
  scripts.compile()
  compileHTML()

  if (config.watch) {
    chokidar.watch(config.watch).on('change', (file) => {
      if (/(\.js|\.ts)$/i.test(file)) scripts.compile()
      if (/(\.sass|\.scss|\.css)$/i.test(file)) styles.compile()
      if (/(\.html|\.njk)$/i.test(file)) compileHTML()
    })
  }

  if (!config.watch && !config.livereload && !config.serve) {
    process.exit(1)
  }
}

function generateMarkupGlobPattern(excludes) {
  let markupDefaultExcludes = ['node_modules', '.git', '.svn', '.hg']

  if (excludes) {
    markupDefaultExcludes.push(...excludes)
  }

  if (config.includePaths) {
    markupDefaultExcludes.push(...config.includePaths)
  }

  markupDefaultExcludes.push('_*')

  markupDefaultExcludes = [...new Set(markupDefaultExcludes)] // Remove duplicates

  return `!(${markupDefaultExcludes.join('|')})/**/*.+(html|njk)`
}

function compileTemplate(templateName, context) {
  return new Promise((resolve, reject) => {
    nunjucksEnv.getTemplate(templateName).render(context, (error, result) => {
      if (!error) {
        resolve(result)
      } else {
        reject(error)
      }
    })
  })
}

function compileHTML() {
  if (!config.markup && !config.markup.in) return

  const markupIn = path.join(cwd, config.markup.in)

  if (!pathExists(markupIn)) {
    console.log(`${style.redBright + style.bold}[error]${style.reset} Markup path does not exist: ${style.dim}${markupIn}${style.reset}`)
    return
  }

  if (pathIsDirectory(markupIn)) {
    const markupFiles = [...glob.sync(path.join(markupIn, generateMarkupGlobPattern(config.markup.includePaths))), ...glob.sync(path.join(markupIn, '*.+(html|njk)'))]
    markupFiles.forEach((file) => {
      const markupOut = path.join(cwd, path.relative(config.markup.in, file))
      const markupOutDir = path.dirname(markupOut)

      if (!pathExists(markupOutDir)) {
        fs.mkdirSync(markupOutDir, { recursive: true })
      }

      compileTemplate(file, pkg).then((result) => {
        fs.writeFileSync(markupOut, result)
        console.log(`${style.cyanBright + style.bold}[markup]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${path.relative(cwd, markupOut)}${style.reset}`)
      })
    })
  } else {
    compileTemplate(markupIn, pkg).then((result) => {
      fs.writeFileSync(path.join(cwd, config.markup.out, path.basename(markupIn)), result)
      console.log(`${style.cyanBright + style.bold}[markup]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${path.relative(cwd, path.join(cwd, config.markup.out, path.basename(markupIn)))}${style.reset}`)
    })
  }
}

// CLI Header
console.log(`\n${style.color('#8b4513')}💩 Poops — v${pkg.version}
----------------${style.reset + style.bell}\n`)

// Check if poops.json exists
if (!pathExists(configPath)) {
  console.log(`${style.redBright + style.bold}[error]${style.reset} \`${style.underline}${defaultConfigPath}${style.reset}\` not found.
${style.dim}Configuration file \`${style.underline}${defaultConfigPath}${style.reset}${style.dim}\` not found in your working directory: ${style.underline}${cwd}${style.reset}\n
${style.dim}Please specify another file path or create a \`poops.json\` file in your working directory and try again.\n
${style.dim}For information on the structure of the configuration file, please visit: \n${style.underline}https://stamat.github.io/poops${style.reset}\n`)
  process.exit(1)
}

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

if (config.markup && config.markup.in) {
  nunjucksEnv = new nunjucks.Environment(new RelativeLoader(path.join(cwd, config.markup.in), config.markup.includePaths), {
    autoescape: true,
    watch: false,
    noCache: true
  })

  if (!config.markup.out) {
    config.markup.out = cwd
  }
}

if (config.watch) {
  config.watch = Array.isArray(config.watch) ? config.watch : [config.watch]
}

if (config.includePaths) {
  config.includePaths = Array.isArray(config.includePaths) ? config.includePaths : [config.includePaths]
} else {
  config.includePaths = ['node_modules']
}

const styles = new Styles(config)
const scripts = new Scripts(config)

// Start the webserver
if (config.serve) {
  const app = connect()

  if (config.serve.base && pathExists(cwd, config.serve.base)) {
    app.use(serveStatic(path.join(cwd, config.serve.base)))
  } else {
    app.use(serveStatic(cwd))
  }

  const port = config.serve.port ? parseInt(config.serve.port, 10) : 4040
  http.createServer(app).listen(port, () => {
    console.log(`${style.blue + style.bold}[info]${style.reset} ${style.dim}🌍 Local server:${style.reset} ${style.italic + style.underline}http://localhost:${port}${style.reset}`)
    poops()
  })
} else {
  poops()
}
