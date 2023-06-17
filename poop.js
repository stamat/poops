#!/usr/bin/env node

const chokidar = require('chokidar')
const connect = require('connect')
const fs = require('node:fs')
const http = require('node:http')
const livereload = require('livereload')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const sass = require('sass')
const serveStatic = require('serve-static')

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
  const importPath = path.relative(process.cwd(), path.join(pathToFileURL('node_modules').pathname, url))

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

// Start local server with LiveReload
const app = connect()
app.use(serveStatic(__dirname))
const port = 4040
http.createServer(app).listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

const lrserver = livereload.createServer({
  exclusions: ['.git/', '.svn/', '.hg/', 'node_modules/', 'src/']
})
lrserver.watch(__dirname)
lrserver.watcher.on('all', (event, file) => {
  console.log(event, file)
})

const recompileWatcher = chokidar.watch('src')
compileSass()

recompileWatcher.on('change', (event, file) => {
  console.log(event, file)
  compileSass()
})
