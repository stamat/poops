import fs from 'node:fs'
import { globSync, hasMagic } from 'glob'
import {
  pathExists,
  mkPath,
  pathForFile,
  buildStyleOutputFilePath,
  fillBannerTemplate,
  buildTime,
  fileSize
} from './utils/helpers.js'
import minifyToFile from './utils/minify.js'
import path from 'node:path'
import * as sass from 'sass'
import log from './utils/log.js'
import { sassPathResolver } from 'sass-path-resolver'
import { sassTokenImporter } from 'sass-token-importer'

export default class Styles {
  constructor(config) {
    this.config = config
    this.banner = config.banner ? fillBannerTemplate(config.banner) : null
  }

  async compile() {
    if (!this.config.styles) return
    this.config.styles = Array.isArray(this.config.styles) ? this.config.styles : [this.config.styles]
    for (const styleEntry of this.config.styles) {
      if (!styleEntry.in || !styleEntry.out) continue
      // `in` may be an array of entry points and/or globs — same resolution as scripts
      const configured = Array.isArray(styleEntry.in) ? styleEntry.in : [styleEntry.in]
      const entryPoints = []
      let missing = false
      for (const entry of configured) {
        if (hasMagic(entry)) {
          // Globs must use `/` even on Windows; sort for deterministic build order.
          // Skip sass partials (_*.scss) — they are imports, not entry points.
          const matches = globSync(entry, { posix: true }).filter(match => !path.basename(match).startsWith('_')).sort()
          if (!matches.length) {
            log({ tag: 'style', error: true, text: 'Entry does not exist:', link: entry })
            missing = true
          }
          entryPoints.push(...matches)
        } else if (!pathExists(entry)) {
          log({ tag: 'style', error: true, text: 'Entry does not exist:', link: entry })
          missing = true
        } else {
          entryPoints.push(entry)
        }
      }
      if (missing) continue
      if (entryPoints.length > 1 && pathForFile(styleEntry.out)) {
        log({ tag: 'error', text: 'Cannot output multiple style files to a single file. Please specify an output directory path instead.' })
        process.exit(1)
      }
      for (const entryPoint of entryPoints) {
        await this.compileEntry(entryPoint, styleEntry.out, styleEntry.options)
      }
    }
  }

  async compileEntry(infilePath, outfilePath, options = {}) {
    const includePaths = this.config.includePaths || []

    const importers = [sassPathResolver(includePaths)]

    if (options.tokenPaths) {
      const tokenOpts = {}
      if (options.tokenOutput) tokenOpts.output = options.tokenOutput
      if (options.resolveAliases !== undefined) tokenOpts.resolveAliases = options.resolveAliases
      importers.push(sassTokenImporter(options.tokenPaths, tokenOpts))
    }

    const opts = {
      sourceMap: false,
      sourceMapIncludeSources: false,
      importers
    }

    if (options.sourcemap) {
      opts.sourceMap = options.sourcemap
      opts.sourceMapIncludeSources = options.sourcemap
    }

    outfilePath = buildStyleOutputFilePath(infilePath, outfilePath)
    mkPath(outfilePath) // resolved file path — mkPath on a dir out is a no-op

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

    await minifyToFile({
      outfilePath,
      loader: 'css',
      code: compiledSass.css,
      banner: this.banner,
      tag: 'style',
      options,
      startTime: options.justMinified ? stylesStart : undefined
    })
  }
}
