import fs from 'node:fs'
import { globSync, hasMagic } from 'glob'
import {
  pathExists,
  mkPath,
  pathForFile,
  buildStyleOutputFilePath,
  isIndexEntry,
  globBase,
  indexEntryOut,
  entryBase,
  hasOutTemplate,
  fillOutTemplate,
  insertMinSuffix,
  fillPackageTokens,
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
    this.banner = config.banner ? fillPackageTokens(config.banner) : null
    // The css files the last compile wrote. Globs and templated `out` name a
    // file per match, so the config alone can't say what landed where — the
    // livereload chain reads this to hot-swap exactly the stylesheets rebuilt.
    this.outputs = []
  }

  async compile() {
    if (!this.config.styles) return
    this.outputs = []
    this.config.styles = Array.isArray(this.config.styles) ? this.config.styles : [this.config.styles]
    for (const styleEntry of this.config.styles) {
      if (!styleEntry.in || !styleEntry.out) continue
      // `in` may be an array of entry points and/or globs — same resolution as scripts
      const configured = Array.isArray(styleEntry.in) ? styleEntry.in : [styleEntry.in]
      const entryPoints = []
      const indexEntries = new Map()
      const bases = new Map()
      const templated = hasOutTemplate(styleEntry.out)
      let missing = false
      for (const entry of configured) {
        if (hasMagic(entry, { magicalBraces: true })) {
          // Globs must use `/` even on Windows; sort for deterministic build order.
          // Skip sass partials (_*.scss) — they are imports, not entry points.
          const matches = globSync(entry, { posix: true }).filter(match => !path.basename(match).startsWith('_')).sort()
          if (!matches.length) {
            log({ tag: 'style', error: true, text: 'Entry does not exist:', link: entry })
            missing = true
          }
          // A glob-matched `index.scss` is named after its directory, relative
          // to the glob's static prefix — otherwise every component collides on
          // `index.css`. Literal entries keep their basename — see `isIndexEntry`.
          const base = globBase(entry)
          for (const match of matches) {
            if (isIndexEntry(match)) indexEntries.set(match, indexEntryOut(match, base))
            bases.set(match, base)
          }
          entryPoints.push(...matches)
        } else if (!pathExists(entry)) {
          log({ tag: 'style', error: true, text: 'Entry does not exist:', link: entry })
          missing = true
        } else {
          bases.set(entry, entryBase(entry))
          entryPoints.push(entry)
        }
      }
      if (missing) continue
      // A templated `out` resolves to a different file per entry point, so the
      // single-file guard doesn't apply to it
      if (!templated && entryPoints.length > 1 && pathForFile(styleEntry.out)) {
        log({ tag: 'error', text: 'Cannot output multiple style files to a single file. Please specify an output directory path instead.' })
        process.exit(1)
      }
      for (const entryPoint of entryPoints) {
        // Resolve the index rename here, where `out` is still known to be a dir
        let out = styleEntry.out
        if (templated) out = fillOutTemplate(out, entryPoint, bases.get(entryPoint))
        else if (indexEntries.has(entryPoint) && !pathForFile(out)) out = path.join(out, `${indexEntries.get(entryPoint)}.css`)
        await this.compileEntry(entryPoint, out, styleEntry.options)
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
    // after the write — a failed compile has nothing to reload. `justMinified`
    // deletes this file below, so only the .min path is worth reporting then.
    if (!options.justMinified) this.outputs.push(outfilePath)
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

    // Pages link whichever spelling they were written against, and with
    // `minify` on that is usually the .min file. Reporting only the plain one
    // meant the reload client could find no matching stylesheet and fell back
    // to reloading the whole page on every style edit.
    if (options.minify) this.outputs.push(insertMinSuffix(outfilePath))
  }
}
