#!/usr/bin/env node

const chokidar = require('chokidar')
const connect = require('connect')
const { build } = require('esbuild')
const fs = require('node:fs')
const http = require('node:http')
const livereload = require('livereload')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const sass = require('sass')
const serveStatic = require('serve-static')

const cwd = process.cwd() // Current Working Directory
const pkg = require('./package.json')

class Styled {
  constructor(string) {
    this.value = String(string)
  }

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

    this.value = `\x1b[38;5;${this.terminalColorIndex(red, green, blue)}m${this.value}`
    return this
  }

  background(hex) {
    const [red, green, blue] = this.hexToRgb(hex)

    this.value = `\x1b[48;5;${this.terminalColorIndex(red, green, blue)}m${this.value}`
    return this
  }

  reset() {
    this.value = `${this.value}\x1b[0m`
    return this
  }

  toString() {
    return this.value
  }

  valueOf() {
    return this.value
  }
}

console.log('')
console.log(new Styled(`💩 Poop — v${pkg.version}`).color('#8b4513').toString())
console.log(new Styled('----------------').reset().toString())
console.log('')

const app = connect()
app.use(serveStatic(cwd))
const port = 4040
http.createServer(app).listen(port, () => {
  console.log(`\x1b[2m🌍 Local server:\x1b[0m \x1b[4mhttp://localhost:${port}\x1b[0m`)
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
  // Compile Sass to CSS
  const compiledSass = sass.compile('src/scss/index.scss', {
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

  fs.writeFileSync('dist/styles.css.map', JSON.stringify(compiledSass.sourceMap))
  fs.writeFileSync('dist/styles.css', compiledSass.css)
}

function compileJs() {
  build({
    logLevel: 'info',
    entryPoints: ['src/js/main.ts'],
    bundle: true,
    outfile: 'dist/scripts.js',
    sourcemap: true,
    minify: false,
    format: 'iife',
    target: 'es2019'
  }).catch(() => process.exit(1))
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
