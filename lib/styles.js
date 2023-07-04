const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')
const fs = require('node:fs')
const helpers = require('./utils/helpers.js')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const postcss = require('postcss')
const sass = require('sass')
const Style = require('./utils/style.js')

const {
  pathExists,
  pathIsDirectory,
  mkPath,
  insertMinSuffix,
  buildStyleOutputFilePath,
  fillBannerTemplate,
  buildTime,
  fileSize
} = helpers

const style = new Style()

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
  const importPath = path.relative(process.cwd(), path.join(resolvedPath.pathname, url))

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

module.exports = class Styles {
  constructor(config) {
    this.config = config
    this.banner = config.banner ? fillBannerTemplate(config.banner) : null
  }

  compile() {
    if (!this.config.styles) return
    this.config.styles = Array.isArray(this.config.styles) ? this.config.styles : [this.config.styles]
    for (const styleEntry of this.config.styles) {
      if (styleEntry.in && styleEntry.out && pathExists(styleEntry.in)) {
        mkPath(styleEntry.out)
        this.compileEntry(styleEntry.in, styleEntry.out, styleEntry.options)
      }
    }
  }

  compileEntry(infilePath, outfilePath, options = {}) {
    const includePaths = this.config.includePaths || []

    const opts = {
      sourceMap: false,
      sourceMapIncludeSources: false,
      importers: [{
        // Resolve `includePaths`.
        findFileUrl(url) {
          for (const includePath of includePaths) {
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
    if (this.banner) compiledSass.css = this.banner + '\n' + compiledSass.css
    fs.writeFileSync(outfilePath, compiledSass.css + mapsrc)
    const cssEnd = performance.now()
    if (!options.justMinified) console.log(`${style.magentaBright + style.bold}[style]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${outfilePath}${style.reset} ${style.greenBright}${fileSize(outfilePath)}${style.reset} ${style.green}(${buildTime(cssStart, cssEnd)})${style.reset}`)

    if (compiledSass.sourceMap) {
      if (this.banner) compiledSass.sourceMap.mappings = ';' + compiledSass.sourceMap.mappings
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
        if (this.banner) result.css = this.banner + '\n' + result.css
        fs.writeFileSync(minPath, result.css)
        const cssMinEnd = performance.now()
        console.log(`${style.magentaBright + style.bold}[style]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${minPath}${style.reset} ${style.greenBright}${fileSize(minPath)}${style.reset} ${style.green}(${buildTime(cssMinStart, cssMinEnd)})${style.reset}`)
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
}