#!/usr/bin/env node

const autoprefixer = require('autoprefixer')
const { build } = require('esbuild')
const chokidar = require('chokidar')
const connect = require('connect')
const cssnano = require('cssnano')
const deepmerge = require('deepmerge')
const fs = require('node:fs')
const glob = require('glob')
const http = require('node:http')
const livereload = require('livereload')
const nunjucks = require('nunjucks')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const postcss = require('postcss')
const sass = require('sass')
const serveStatic = require('serve-static')
const Terser = require('terser')

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

// Helpers

class Style {
  reset = '\x1b[0m'
  bold = '\x1b[1m'
  dim = '\x1b[2m'
  italic = '\x1b[3m'
  underline = '\x1b[4m'
  blink = '\x1b[5m'
  inverse = '\x1b[7m'
  hidden = '\x1b[8m'
  strikethrough = '\x1b[9m'
  black = '\x1b[30m'
  red = '\x1b[31m'
  redBright = '\x1b[91m'
  green = '\x1b[32m'
  greenBright = '\x1b[92m'
  yellow = '\x1b[33m'
  yellowBright = '\x1b[93m'
  blue = '\x1b[34m'
  blueBright = '\x1b[94m'
  magenta = '\x1b[35m'
  magentaBright = '\x1b[95m'
  cyan = '\x1b[36m'
  cyanBright = '\x1b[96m'
  white = '\x1b[37m'
  whiteBright = '\x1b[97m'
  gray = '\x1b[90m'
  bgBlack = '\x1b[40m'
  bgRed = '\x1b[41m'
  bgRedBright = '\x1b[101m'
  bgGreen = '\x1b[42m'
  bgGreenBright = '\x1b[102m'
  bgYellow = '\x1b[43m'
  bgYellowBright = '\x1b[103m'
  bgBlue = '\x1b[44m'
  bgBlueBright = '\x1b[104m'
  bgMagenta = '\x1b[45m'
  bgMagentaBright = '\x1b[105m'
  bgCyan = '\x1b[46m'
  bgCyanBright = '\x1b[106m'
  bgWhite = '\x1b[47m'
  bgWhiteBright = '\x1b[107m'
  bgGray = '\x1b[100m'
  bell = '\x07'

  hexToRgb(hex) {
    const sanitizedHex = hex.replace('#', '')
    const red = parseInt(sanitizedHex.substring(0, 2), 16)
    const green = parseInt(sanitizedHex.substring(2, 4), 16)
    const blue = parseInt(sanitizedHex.substring(4, 6), 16)

    return [red, green, blue]
  }

  terminalColorIndex(red, green, blue) {
    return 16 +
      Math.round(red / 255 * 5) * 36 +
      Math.round(green / 255 * 5) * 6 +
      Math.round(blue / 255 * 5)
  }

  color(hex) {
    const [red, green, blue] = this.hexToRgb(hex)

    return `\x1b[38;5;${this.terminalColorIndex(red, green, blue)}m`
  }

  background(hex) {
    const [red, green, blue] = this.hexToRgb(hex)

    return `\x1b[48;5;${this.terminalColorIndex(red, green, blue)}m`
  }
}

const style = new Style()

function pathExists() {
  return fs.existsSync(path.join(...arguments))
}

function pathIsDirectory() {
  return fs.lstatSync(path.join(...arguments)).isDirectory()
}

function mkPath(filePath) {
  const dirPath = path.dirname(filePath)
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function pathForFile(filePath) {
  return /\./.test(path.basename(filePath))
}

function insertMinSuffix(filePath) {
  const { name, ext } = path.parse(filePath)
  return path.join(path.dirname(filePath), `${name}.min${ext}`)
}

function buildStyleOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name } = path.parse(inputPath)
  return path.join(path.join(outputPath, `${name}.css`))
}

function buildScriptOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name, ext } = path.parse(inputPath)
  return path.join(path.join(outputPath, `${name}${ext.replace('t', 'j')}`))
}

function fillBannerTemplate(template, packagesPath) {
  packagesPath = packagesPath || cwd
  const packagesFilePath = path.join(packagesPath, 'package.json')
  if (!pathExists(packagesFilePath)) return template
  const pkg = require(packagesFilePath)
  const { name, version, homepage, description, license, author } = pkg
  const year = new Date().getFullYear()

  return template
    .replace(/{{\s?name\s?}}/g, name)
    .replace(/{{\s?version\s?}}/g, version)
    .replace(/{{\s?homepage\s?}}/g, homepage)
    .replace(/{{\s?description\s?}}/g, description)
    .replace(/{{\s?author\s?}}/g, author)
    .replace(/{{\s?license\s?}}/g, license)
    .replace(/{{\s?year\s?}}/g, year)
}

function buildTime(start, end) {
  const time = Math.round(end - start)
  if (time < 1000) return `${time}ms`
  if (time < 60 * 1000) return `${(time / 1000).toFixed(0)}s ${time % 1000}ms`
  return `${(time / 1000 / 60).toFixed(0)}m ${((time / 1000) % 60).toFixed(0)}s ${time % 1000}ms`
}

// SCSS/SASS Compiler
function tryToFindFile(filePath, extensions) {
  const fileExt = extensions.find(ext => fs.existsSync(`${filePath}.${ext}`))
  if (fileExt) {
    return `${filePath}.${fileExt}`
  }
  return null
}

function sassPathResolver(url, resolvePath) {
  if (fs.existsSync(url)) return new URL(url)
  const resolvedPath = pathToFileURL(resolvePath)
  if (!fs.existsSync(resolvedPath.pathname)) return null
  const importPath = path.relative(cwd, path.join(resolvedPath.pathname, url))

  if (!fs.existsSync(importPath)) {
    const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])
    if (correctFile) return new URL(correctFile, resolvedPath)
  }

  if (pathIsDirectory(importPath) && !pathExists(importPath, 'index.sass') && !pathExists(importPath, 'index.scss')) {
    const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])
    if (correctFile) return new URL(correctFile, resolvedPath)

    if (!pathExists(importPath, 'package.json')) return null

    const pkg = require(path.join(importPath, 'package.json'))

    if (pkg.sass) return new URL(path.join(importPath, pkg.sass), resolvedPath)
    if (pkg.css) return new URL(path.join(importPath, pkg.css), resolvedPath)

    const basename = path.basename(pkg.main)
    if (pkg.main && /(\.sass|\.scss|\.css)$/i.test(basename)) return new URL(path.join(importPath, pkg.main), resolvedPath)
    return null
  }

  return new URL(importPath, resolvedPath)
}

function compileStyles() {
  if (!config.styles) return
  config.styles = Array.isArray(config.styles) ? config.styles : [config.styles]
  for (const styleEntry of config.styles) {
    if (styleEntry.in && styleEntry.out && pathExists(styleEntry.in)) {
      mkPath(styleEntry.out)
      compileStylesEntry(styleEntry.in, styleEntry.out, styleEntry.options)
    }
  }
}

function compileStylesEntry(infilePath, outfilePath, options = {}) {
  const opts = {
    sourceMap: false,
    sourceMapIncludeSources: false,
    importers: [{
      // Resolve `includePaths`.
      findFileUrl(url) {
        for (const includePath of config.includePaths) {
          const resolvedPath = sassPathResolver(url, includePath)
          if (resolvedPath) return resolvedPath
        }
        return null
      }
    }]
  }

  if (options.sourcemap) {
    opts.sourceMap = options.sourcemap
    opts.sourceMapIncludeSources = options.sourcemap
  }

  outfilePath = buildStyleOutputFilePath(infilePath, outfilePath, options)

  const cssStart = performance.now()
  const compiledSass = sass.compile(infilePath, opts)
  const mapsrc = options.sourcemap ? `\n/*# sourceMappingURL=${path.basename(outfilePath)}.map */` : ''
  if (banner) compiledSass.css = banner + '\n' + compiledSass.css
  fs.writeFileSync(outfilePath, compiledSass.css + mapsrc)
  const cssEnd = performance.now()
  if (!options.justMinified) console.log(`${style.magentaBright + style.bold}[style]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${outfilePath}${style.reset} ${style.greenBright}(${buildTime(cssStart, cssEnd)})${style.reset}`)

  if (compiledSass.sourceMap) {
    if (banner) compiledSass.sourceMap.mappings = ';' + compiledSass.sourceMap.mappings
    fs.writeFileSync(`${outfilePath}.map`, JSON.stringify(compiledSass.sourceMap))
    console.log(`${style.magentaBright + style.bold}[style]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${outfilePath}.map${style.reset}`)
  }

  const cssMinStart = performance.now()
  const minPath = insertMinSuffix(outfilePath)
  if (options.minify) {
    postcss([autoprefixer, cssnano]).process(compiledSass.css, {
      from: outfilePath,
      to: minPath
    }).then(result => {
      if (banner) result.css = banner + '\n' + result.css
      fs.writeFileSync(minPath, result.css)
      const cssMinEnd = performance.now()
      console.log(`${style.magentaBright + style.bold}[style]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${minPath}${style.reset} ${style.greenBright}(${buildTime(cssMinStart, cssMinEnd)})${style.reset}`)
    }).catch((error) => {
      console.log(`${style.redBright + style.bold}[error]${style.reset} Error occurred during CSS minification: ${style.dim}${error}${style.reset}`)
    })

    if (options.justMinified) {
      fs.unlinkSync(outfilePath)
    }
  } else {
    fs.unlinkSync(minPath)
  }
}

// JS/TS Compiler
function compileScripts() {
  if (!config.scripts) return
  config.scripts = Array.isArray(config.scripts) ? config.scripts : [config.scripts]
  for (const scriptEntry of config.scripts) {
    if (scriptEntry.in && scriptEntry.out && pathExists(scriptEntry.in)) {
      mkPath(scriptEntry.out)
      compileScriptsEntry(scriptEntry.in, scriptEntry.out, scriptEntry.options)
    }
  }
}

function compileScriptsEntry(infilePath, outfilePath, options = {}) {
  if (!Array.isArray(infilePath)) infilePath = [infilePath]

  const opts = {
    logLevel: 'error',
    entryPoints: infilePath,
    bundle: true,
    sourcemap: false,
    minify: false,
    format: 'iife',
    target: 'es2019',
    nodePaths: config.includePaths // Resolve `includePaths`
  }

  const terserOpts = {
    mangle: false
  }

  if (banner) {
    opts.banner = {
      js: banner,
      css: banner
    }
  }

  if (!pathForFile(outfilePath)) {
    opts.outdir = outfilePath
  } else {
    if (infilePath.length > 1) {
      console.log(`${style.redBright + style.bold}[error]${style.reset} Cannot output multiple ${style.bold + style.underline}script${style.reset} files to a single file. Please specify an output directory path instead.`)
      process.exit(1)
    }
    opts.outfile = outfilePath
  }

  if (options.format) opts.format = options.format
  if (options.target) opts.target = options.target
  if (options.nodePaths) opts.nodePaths = [...new Set([...opts.nodePaths, ...options.nodePaths])]
  if (options.sourcemap) opts.sourcemap = options.sourcemap

  if (options.mangle) terserOpts.mangle = options.mangle

  delete options.mangle
  deepmerge(opts, options) // ability to pass other esbuild options `node_modules/esbuild/lib/main.d.ts`

  // TODO: Actually loop the build process for each entry point!!!
  const esbuildStart = performance.now()
  build(opts).then(() => {
    const esbuildEnd = performance.now()
    for (const entry of infilePath) {
      const newOutFilePath = buildScriptOutputFilePath(entry, outfilePath)
      const minPath = insertMinSuffix(newOutFilePath)

      if (!options.justMinified) console.log(`${style.yellowBright + style.bold}[script]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${newOutFilePath}${style.reset} ${style.greenBright}(${buildTime(esbuildStart, esbuildEnd)})${style.reset}`)
      if (options.sourcemap) console.log(`${style.yellowBright + style.bold}[script]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${newOutFilePath}.map${style.reset}`)

      if (options.minify) {
        const terserStart = performance.now()
        Terser.minify(fs.readFileSync(newOutFilePath, 'utf-8'), { mangle: terserOpts.mangle }).then((result) => {
          if (result.error) {
            console.log(`${style.redBright + style.bold}[error]${style.reset} Error occurred during JS minification: ${style.dim}${result.error}${style.reset}`)
          } else {
            if (banner) result.code = banner + '\n' + result.code
            fs.writeFileSync(minPath, result.code)
            const terserEnd = performance.now()
            console.log(`${style.yellowBright + style.bold}[script]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${minPath}${style.reset} ${style.greenBright}(${buildTime(terserStart, terserEnd)})${style.reset}`)
          }
        })

        if (options.justMinified) {
          fs.unlinkSync(newOutFilePath)
        }
      } else {
        fs.unlinkSync(minPath)
      }
    }
  })
}

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

  compileStyles()
  compileScripts()
  compileHTML()

  if (config.watch) {
    chokidar.watch(config.watch).on('change', (file) => {
      if (/(\.js|\.ts)$/i.test(file)) compileScripts()
      if (/(\.sass|\.scss|\.css)$/i.test(file)) compileStyles()
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
        console.log(`${style.cyanBright + style.bold}[markup]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${markupOut}${style.reset}`)
      })
    })
  } else {
    compileTemplate(markupIn, pkg).then((result) => {
      fs.writeFileSync(path.join(cwd, config.markup.out, path.basename(markupIn)), result)
      console.log(`${style.cyanBright + style.bold}[markup]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${path.join(cwd, config.markup.out, path.basename(markupIn))}${style.reset}`)
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

const banner = config.banner ? fillBannerTemplate(config.banner) : null

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
