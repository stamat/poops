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

class Style {
  reset = '\x1b[0m'
  bold = '\x1b[1m'
  dim = '\x1b[2m'
  italic = '\x1b[3m'
  underline = '\x1b[4m'
  inverse = '\x1b[7m'
  hidden = '\x1b[8m'
  strikethrough = '\x1b[9m'
  black = '\x1b[30m'
  red = '\x1b[31m'
  green = '\x1b[32m'
  yellow = '\x1b[33m'
  blue = '\x1b[34m'
  magenta = '\x1b[35m'
  cyan = '\x1b[36m'
  white = '\x1b[37m'
  gray = '\x1b[90m'
  bgBlack = '\x1b[40m'
  bgRed = '\x1b[41m'
  bgGreen = '\x1b[42m'
  bgYellow = '\x1b[43m'
  bgBlue = '\x1b[44m'
  bgMagenta = '\x1b[45m'
  bgCyan = '\x1b[46m'
  bgWhite = '\x1b[47m'
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

console.log('')
console.log(`${style.color('#8b4513')}💩 Poop — v${pkg.version}`)
console.log(`----------------${style.reset + style.bell}`)
console.log('')

const app = connect()
app.use(serveStatic(cwd))
const port = 4040
http.createServer(app).listen(port, () => {
  console.log(`${style.dim}🌍 Local server:${style.reset} ${style.italic + style.underline}http://localhost:${port}${style.reset}`)
})

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function pathExists() {
  return fs.existsSync(path.join(...arguments))
}

function pathIsDirectory() {
  return fs.lstatSync(path.join(...arguments)).isDirectory()
}

function tryToFindFile(filePath, extensions) {
  const fileExt = extensions.find(ext => fs.existsSync(`${filePath}.${ext}`))
  if (fileExt) {
    return `${filePath}.${fileExt}`
  }
  return null
}

function sassImporter(url) {
  if (fs.existsSync(url)) return null
  const importPath = path.relative(cwd, path.join(pathToFileURL('node_modules').pathname, url))

  if (!fs.existsSync(importPath)) {
    const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])
    if (correctFile) return new URL(correctFile, pathToFileURL('node_modules'))
  }

  if (pathIsDirectory(importPath) && !pathExists(importPath, 'index.sass') && !pathExists(importPath, 'index.scss')) {
    const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])
    if (correctFile) return new URL(correctFile, pathToFileURL('node_modules'))

    if (!pathExists(importPath, 'package.json')) return null

    const pkg = readJsonFile(path.join(importPath, 'package.json'))

    if (pkg.sass) return new URL(path.join(importPath, pkg.sass), pathToFileURL('node_modules'))
    if (pkg.css) return new URL(path.join(importPath, pkg.css), pathToFileURL('node_modules'))

    const basename = path.basename(pkg.main)
    if (pkg.main && /(\.sass|\.scss|\.css)$/i.test(basename)) return new URL(path.join(importPath, pkg.main), pathToFileURL('node_modules'))
    return null
  }

  return new URL(importPath, pathToFileURL('node_modules'))
}

function compileSass() {
  console.log(`${style.green+style.bold}[Style]${style.reset} Compiling SASS...`)
  compileSassEntry('src/scss/index.scss', 'dist/styles.css')
}

function compileSassEntry(infilePath, outfilePath) {
  const compiledSass = sass.compile(infilePath, {
    style: 'compressed',
    sourceMap: true,
    sourceMapIncludeSources: true,
    importers: [{
      // Resolve `node_modules`.
      findFileUrl(url) {
        return sassImporter(url)
      }
    }]
  })

  fs.writeFileSync(outfilePath, compiledSass.css)
  fs.writeFileSync(`${outfilePath}.map`, JSON.stringify(compiledSass.sourceMap))

  postcss([autoprefixer, cssnano]).process(compiledSass.css, {
    from: outfilePath,
    to: outfilePath.replace('.css', '.min.css'),
  }).then(result => {
    fs.writeFileSync(outfilePath.replace('.css', '.min.css'), result.css)
  }).catch((error) => {
    console.error('Error occurred during CSS minification:', error)
  })
}

function compileJs() {
  compileJsEntry('src/js/main.ts', 'dist/scripts.js')
}

function compileJsEntry(infilePath, outfilePath) {
  build({
    logLevel: 'error',
    entryPoints: [infilePath],
    bundle: true,
    outfile: outfilePath,
    sourcemap: true,
    minify: false,
    format: 'iife',
    target: 'es2019'
  }).then(() => {
    Terser.minify(fs.readFileSync(outfilePath, 'utf-8')).then((result) => {
      if (result.error) {
        console.error('Error occurred during JS minification:', result.error)
      } else {
        fs.writeFileSync(outfilePath.replace('.js', '.min.js'), result.code)
      }
    })
  })
}

const lrserver = livereload.createServer({
  exclusions: ['.git/', '.svn/', '.hg/', 'node_modules/', 'src/']
})
lrserver.watch(cwd)

const sourceWatcher = chokidar.watch('src')
compileSass()
compileJs()

sourceWatcher.on('change', (file) => {
  if (/(\.js|\.ts)$/i.test(file)) compileJs()
  if (/(\.sass|\.scss|\.css)$/i.test(file)) compileSass()
})
