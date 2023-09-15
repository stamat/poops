const { transform } = require('esbuild')
const fs = require('node:fs')
const helpers = require('./utils/helpers.js')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const sass = require('sass')
const PrintStyle = require('./utils/print-style.js')

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

const pstyle = new PrintStyle()

function tryToFindFile(filePath, extensions) {
  const fileExt = extensions.find(ext => fs.existsSync(`${filePath}.${ext}`))
  if (fileExt) {
    return `${filePath}.${fileExt}`
  }
  return null
}

function sassPathResolver(url, resolvePath, infilePath) {
  const resolvedPath = pathToFileURL(resolvePath)
  if (!fs.existsSync(resolvedPath.pathname)) return null
  const importPath = path.relative(process.cwd(), path.join(resolvedPath.pathname, url))

  if (!fs.existsSync(importPath)) { // Will this ever fire?
    const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])
    if (correctFile) return new URL(correctFile, resolvedPath)
  }

  if (pathIsDirectory(importPath) && !pathExists(importPath, 'index.sass') && !pathExists(importPath, 'index.scss')) {
    const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])

    if (correctFile) return new URL(correctFile, resolvedPath)

    if (!pathExists(importPath, 'package.json')) return null

    const pkg = require(path.join(process.cwd(), importPath, 'package.json'))

    let style = pkg.style || pkg.sass || pkg.main || pkg.css || pkg.scss || pkg.files
    if (!style) return null

    if (!Array.isArray(style)) {
      style = [style]
    }

    for (const styleEntry of style) {
      if (typeof styleEntry !== 'string') continue
      const stylePath = new URL(path.join(importPath, styleEntry), resolvedPath)
      if (fs.existsSync(stylePath)) return stylePath
    }
  }

  return new URL(importPath, resolvedPath)
}

module.exports = class Styles {
  constructor(config) {
    this.config = config
    this.banner = config.banner ? fillBannerTemplate(config.banner) : null
  }

  async compile() {
    if (!this.config.styles) return
    this.config.styles = Array.isArray(this.config.styles) ? this.config.styles : [this.config.styles]
    for (const styleEntry of this.config.styles) {
      if (styleEntry.in && styleEntry.out && pathExists(styleEntry.in)) {
        mkPath(styleEntry.out)
        await this.compileEntry(styleEntry.in, styleEntry.out, styleEntry.options)
      }
    }
  }

  async compileEntry(infilePath, outfilePath, options = {}) {
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

    const stylesStart = performance.now()
    let compiledSass
    try {
      compiledSass = sass.compile(infilePath, opts)
    } catch (err) {
      console.log(`${pstyle.magentaBright + pstyle.bold}[style]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${outfilePath}${pstyle.reset + pstyle.bell}`)
      console.log(err)
      return
    }
    const mapsrc = options.sourcemap ? `\n/*# sourceMappingURL=${path.basename(outfilePath)}.map */` : ''
    if (this.banner) compiledSass.css = this.banner + '\n' + compiledSass.css
    fs.writeFileSync(outfilePath, compiledSass.css + mapsrc)
    const stylesEnd = performance.now()
    if (!options.justMinified) console.log(`${pstyle.magentaBright + pstyle.bold}[style]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${outfilePath}${pstyle.reset} ${pstyle.greenBright}${fileSize(outfilePath)}${pstyle.reset} ${pstyle.green}(${buildTime(stylesStart, stylesEnd)})${pstyle.reset}`)

    if (compiledSass.sourceMap) {
      if (this.banner) compiledSass.sourceMap.mappings = ';' + compiledSass.sourceMap.mappings
      fs.writeFileSync(`${outfilePath}.map`, JSON.stringify(compiledSass.sourceMap))
      console.log(`${pstyle.magentaBright + pstyle.bold}[style]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${outfilePath}.map${pstyle.reset}`)
    }
    const stylesMinStart = !options.justMinified ? performance.now() : stylesStart
    const minPath = insertMinSuffix(outfilePath)
    if (options.minify) {
      await transform(compiledSass.css, {
        loader: 'css',
        minify: true
      }).then(result => {
        if (this.banner) result.code = this.banner + '\n' + result.code
        fs.writeFileSync(minPath, result.code)
        const stylesMinEnd = performance.now()
        console.log(`${pstyle.magentaBright + pstyle.bold}[style]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset} ${pstyle.greenBright}${fileSize(minPath)}${pstyle.reset} ${pstyle.green}(${buildTime(stylesMinStart, stylesMinEnd)})${pstyle.reset}`)
      }).catch((err) => {
        console.log(`${pstyle.magentaBright + pstyle.bold}[style]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset + pstyle.bell}`)
        console.log(err)
      })

      if (options.justMinified) {
        fs.unlinkSync(outfilePath)
      }
    } else {
      fs.unlinkSync(minPath)
    }
  }
}
