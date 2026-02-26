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
import log from './utils/log.js'
import sassPathResolver from 'sass-path-resolver'

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
      importers: [sassPathResolver(includePaths)]
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
      log({ tag: 'style', error: true, text: 'Failed compiling:', link: outfilePath })
      console.error(err)
      return
    }

    const mapsrc = options.sourcemap ? `\n/*# sourceMappingURL=${path.basename(outfilePath)}.map */` : ''
    if (this.banner) compiledSass.css = this.banner + '\n' + compiledSass.css
    fs.writeFileSync(outfilePath, compiledSass.css + mapsrc)
    const stylesEnd = performance.now()
    if (!options.justMinified) log({ tag: 'style', text: 'Compiled:', link: outfilePath, size: fileSize(outfilePath), time: buildTime(stylesStart, stylesEnd) })

    if (compiledSass.sourceMap) {
      if (this.banner) compiledSass.sourceMap.mappings = ';' + compiledSass.sourceMap.mappings
      fs.writeFileSync(`${outfilePath}.map`, JSON.stringify(compiledSass.sourceMap))
      log({ tag: 'style', text: 'Compiled:', link: `${outfilePath}.map` })
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
        log({ tag: 'style', text: 'Compiled:', link: minPath, size: fileSize(minPath), time: buildTime(stylesMinStart, stylesMinEnd) })
      } catch (err) {
        log({ tag: 'style', error: true, text: 'Failed compiling:', link: minPath })
        console.error(err)
      }

      if (options.justMinified) {
        fs.unlinkSync(outfilePath)
      }
    } else {
      if (pathExists(minPath)) fs.unlinkSync(minPath)
    }
  }
}
