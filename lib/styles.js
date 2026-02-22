import { transform } from 'esbuild'
import fs from 'node:fs'
import {
  pathExists,
  mkPath,
  insertMinSuffix,
  buildStyleOutputFilePath,
  fillBannerTemplate,
  buildTime,
  fileSize
} from './utils/helpers.js'
import path from 'node:path'
import * as sass from 'sass'
import PrintStyle from './utils/print-style.js'
import sassResolver from 'sass-resolver'

const pstyle = new PrintStyle()

export default class Styles {
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
      importers: [sassResolver(includePaths)]
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
