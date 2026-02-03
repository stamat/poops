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
  const pathParts = path.parse(filePath)
  if (pathParts.ext && pathParts.ext.length > 0 && extensions.includes(pathParts.ext.slice(1))) {
    if (fs.existsSync(filePath)) return filePath
  }

  let fileExt = extensions.find(ext => fs.existsSync(`${filePath}.${ext}`))
  if (fileExt) return `${filePath}.${fileExt}`

  if (!pathParts.name.startsWith('_')) {
    pathParts.name = `_${pathParts.name}`
    const underscoredFilePath = path.format(pathParts)
    fileExt = extensions.find(ext => fs.existsSync(`${underscoredFilePath}.${ext}`))
    if (fileExt) return `${underscoredFilePath}.${fileExt}`
  }

  return null
}

function extractMainPathFromPackageJson(packageJsonPath) {
  if (!pathExists(packageJsonPath, 'package.json')) return null

  const pkg = require(path.join(process.cwd(), packageJsonPath, 'package.json'))

  const mainPath = pkg.sass || pkg.scss || pkg.style || pkg.css || pkg.main
  if (!mainPath) return null

  return mainPath
}

function getPackagePath(url) {
  const parts = path.parse(url)
  if (!parts.dir) return null
  const dirChunks = parts.dir.split(path.sep)
  if (dirChunks.length === 0) return null
  if (dirChunks[0].startsWith('@') && dirChunks.length > 1) {
    return path.join(dirChunks[0], dirChunks[1])
  }
  return dirChunks[0]
}

//@BUG: sulphuris/core/config doesn't resolve correctly
//@BUG: sulphuris/core/utils/helpers doesn't resolve correctly
function sassPathResolver(url, resolvePath, infilePath) {
  // check if resole path, like `node_modules` exists
  const resolvedPath = pathToFileURL(resolvePath)
  if (!fs.existsSync(resolvedPath.pathname)) return null
  const importPath = path.relative(process.cwd(), path.join(resolvedPath.pathname, url))

  // 1. Maybe it's a directory?
  if (pathExists(importPath) && pathIsDirectory(importPath)) {
    // Try to find an index file within the directory
    const correctIndexFile = tryToFindFile(path.join(importPath, 'index'), ['sass', 'scss', 'css'])
    if (correctIndexFile) return new URL(correctIndexFile, resolvedPath)

    // package.json discovery
    const style = extractMainPathFromPackageJson(importPath)

    const stylePath = new URL(path.join(importPath, style), resolvedPath)
    if (fs.existsSync(stylePath)) return stylePath
  }

  // 2. Maybe it's a file?
  if (pathExists(importPath)) return pathToFileURL(importPath)

  // 2.1 Try to find the correct file with different formats
  const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])
  if (correctFile) return new URL(correctFile, resolvedPath)

  // 2.2 Maybe it's a file within a package?
  const packagePath = getPackagePath(url)
  if (packagePath) {
    const packageFullPath = path.relative(process.cwd(), path.join(resolvedPath.pathname, packagePath))
    const stylePath = extractMainPathFromPackageJson(packageFullPath)

    if (stylePath) {
      const styleDir = path.dirname(stylePath)
      const styleFinalPath = path.join(packageFullPath, styleDir, url.replace(packagePath, ''))

      const correctPackageFile = tryToFindFile(styleFinalPath, ['sass', 'scss', 'css'])
      if (correctPackageFile) return new URL(correctPackageFile, resolvedPath)
    }
  }

  return null
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
            const resolvedPath = sassPathResolver(url, includePath, infilePath)
            if (resolvedPath && pathExists(resolvedPath.pathname)) return resolvedPath
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

    const minPath = insertMinSuffix(outfilePath)
    if (options.minify) {
      try {
        const stylesMinStart = !options.justMinified ? performance.now() : stylesStart

        const minified = await transform(compiledSass.css, {
          loader: 'css',
          minify: true
        })

        if (this.banner) minified.code = this.banner + '\n' + minified.code
        fs.writeFileSync(minPath, minified.code)
        const stylesMinEnd = performance.now()
        console.log(`${pstyle.magentaBright + pstyle.bold}[style]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset} ${pstyle.greenBright}${fileSize(minPath)}${pstyle.reset} ${pstyle.green}(${buildTime(stylesMinStart, stylesMinEnd)})${pstyle.reset}`)
      } catch (err) {
        console.log(`${pstyle.magentaBright + pstyle.bold}[style]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset + pstyle.bell}`)
        console.log(err)
      }

      if (options.justMinified) {
        fs.unlinkSync(outfilePath)
      }
    } else {
      if (pathExists(minPath)) fs.unlinkSync(minPath)
    }
  }
}
