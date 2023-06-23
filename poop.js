#!/usr/bin/env node

const autoprefixer = require('autoprefixer')
const { build } = require('esbuild')
const chokidar = require('chokidar')
const connect = require('connect')
const cssnano = require('cssnano')
const fs = require('node:fs')
const http = require('node:http')
const livereload = require('livereload')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const postcss = require('postcss')
const sass = require('sass')
const serveStatic = require('serve-static')
const Terser = require('terser')

const cwd = process.cwd() // Current Working Directory
const pkg = require('./package.json')
const args = process.argv.slice(2)

let defaultConfigPath = 'poop.json'

if (args.length) {
  defaultConfigPath = args[0]
}

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
  ext.replace('t', 'j')
  return path.join(path.join(outputPath, `${name}${ext}`))
}

const style = new Style()

// CLI Header
console.log(`\n${style.color('#8b4513')}💩 Poop — v${pkg.version}
----------------${style.reset + style.bell}\n`)

const configPath = path.join(cwd, defaultConfigPath)

// Check if poop.json exists
if (!pathExists(configPath)) {
  console.log(`${style.red + style.bold}[error]${style.reset} \`${defaultConfigPath}\` not found.${style.reset}
${style.dim}Configuration file \`${defaultConfigPath}\` not found in your working directory: ${style.underline}${cwd}${style.reset}\n
${style.dim}Please create a \`poop.json\` file in your working directory and try again.\n
For information about the structure of the configuration file, please visit: \n${style.underline}https://stamat.github.com/poop${style.reset}\n`)
  process.exit(1)
}

// Load poop.json
const config = require(configPath)

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

  const port = parseInt(config.serve.port, 10) || 4040
  http.createServer(app).listen(port, () => {
    console.log(`${style.cyanBright + style.bold}[info]${style.reset} ${style.dim}🌍 Local server:${style.reset} ${style.italic + style.underline}http://localhost:${port}${style.reset}`)
    poop()
  })
} else {
  poop()
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

function compileStyle() {
  if (!config.style) return
  config.style = Array.isArray(config.style) ? config.style : [config.style]
  for (const styleEntry of config.style) {
    if (styleEntry.in && styleEntry.out) {
      mkPath(styleEntry.out)
      compileStyleEntry(styleEntry.in, styleEntry.out, styleEntry.options)
    }
  }
}

function compileStyleEntry(infilePath, outfilePath, options = {}) {
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

  const compiledSass = sass.compile(infilePath, opts)
  const mapsrc = options.sourcemap ? `\n/*# sourceMappingURL=${path.basename(outfilePath)}.map */` : ''
  fs.writeFileSync(outfilePath, compiledSass.css + mapsrc)
  if (compiledSass.sourceMap) {
    fs.writeFileSync(`${outfilePath}.map`, JSON.stringify(compiledSass.sourceMap))
  }

  const minPath = insertMinSuffix(outfilePath)
  if (options.minify) {
    postcss([autoprefixer, cssnano]).process(compiledSass.css, {
      from: outfilePath,
      to: minPath
    }).then(result => {
      fs.writeFileSync(minPath, result.css)
    }).catch((error) => {
      console.error('Error occurred during CSS minification:', error)
    })
  } else {
    fs.unlinkSync(minPath)
  }

  if (options.justMinified) {
    fs.unlinkSync(outfilePath)
  }
}

// JS/TS Compiler
function compileScript() {
  if (!config.script) return
  config.script = Array.isArray(config.script) ? config.script : [config.script]
  for (const scriptEntry of config.script) {
    if (scriptEntry.in && scriptEntry.out) {
      mkPath(scriptEntry.out)
      compileScriptEntry(scriptEntry.in, scriptEntry.out, scriptEntry.options)
    }
  }
}

async function compileScriptEntry(infilePath, outfilePath, options = {}) {
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

  if (!pathForFile(outfilePath)) {
    opts.outdir = outfilePath
  } else {
    opts.outfile = outfilePath
  }

  if (options.format) opts.format = options.format
  if (options.target) opts.target = options.target
  if (options.nodePaths) opts.nodePaths = [...new Set([...opts.nodePaths, ...options.nodePaths])]
  if (options.sourcemap) opts.sourcemap = options.sourcemap

  if (options.mangle) terserOpts.mangle = options.mangle

  build(opts).then(() => {
    for (const entry of infilePath) {
      const minPath = insertMinSuffix(entry)
      const newOutFilePath = buildScriptOutputFilePath(entry, outfilePath)

      if (options.minify) {
        Terser.minify(fs.readFileSync(newOutFilePath, 'utf-8'), { mangle: terserOpts.mangle }).then((result) => {
          if (result.error) {
            console.error('Error occurred during JS minification:', result.error)
          } else {
            fs.writeFileSync(minPath, result.code)
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
function poop() {
  if (config.livereload) {
    const lrExcludes = ['.git', '.svn', '.hg']

    if (config.watch) {
      lrExcludes.push(...config.watch)
    }

    if (config.includePaths) {
      lrExcludes.push(...config.includePaths)
    }

    const lrserver = livereload.createServer({
      exclusions: [...new Set(lrExcludes)]
    })
    console.log(`${style.cyanBright + style.bold}[info]${style.reset} ${style.dim}🔃 LiveReload server:${style.reset} ${style.italic + style.underline}http://localhost:${lrserver.config.port}${style.reset}`)
    lrserver.watch(cwd)
  }

  compileStyle()
  compileScript()

  if (config.watch) {
    chokidar.watch(config.watch).on('change', (file) => {
      if (/(\.js|\.ts)$/i.test(file)) compileScript()
      if (/(\.sass|\.scss|\.css)$/i.test(file)) compileStyle()
    })
  }

  if (!config.watch && !config.livereload && !config.serve) {
    process.exit(1)
  }
}
