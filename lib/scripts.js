import { build } from 'esbuild'
import { deepMerge } from 'book-of-spells'
import {
  pathExists,
  mkPath,
  pathForFile,
  fillBannerTemplate,
  buildTime,
  fileSize
} from './utils/helpers.js'
import minifyToFile from './utils/minify.js'
import log from './utils/log.js'

export default class Scripts {
  constructor(config) {
    this.config = config
    this.banner = config.banner ? fillBannerTemplate(config.banner, config.pkg) : null
  }

  async compile() {
    if (!this.config.scripts) return
    this.config.scripts = Array.isArray(this.config.scripts) ? this.config.scripts : [this.config.scripts]

    for (const scriptEntry of this.config.scripts) {
      if (!scriptEntry.in || !scriptEntry.out) continue
      // `in` may be an array of entry points — pathExists on an array throws
      const entryPoints = Array.isArray(scriptEntry.in) ? scriptEntry.in : [scriptEntry.in]
      const missing = entryPoints.filter((entry) => !pathExists(entry))
      if (missing.length) {
        for (const entry of missing) log({ tag: 'script', error: true, text: 'Entry does not exist:', link: entry })
        continue
      }
      mkPath(scriptEntry.out)
      await this.compileEntry(scriptEntry.in, scriptEntry.out, scriptEntry.options)
    }
  }

  async compileEntry(infilePath, outfilePath, options = {}, tag = 'script') {
    if (!Array.isArray(infilePath)) infilePath = [infilePath]

    const opts = {
      logLevel: 'error',
      entryPoints: infilePath,
      bundle: true,
      sourcemap: false,
      minify: false,
      format: 'iife',
      target: 'es2019',
      nodePaths: this.config.includePaths // Resolve `includePaths`
    }

    if (this.banner) {
      opts.banner = {
        js: this.banner,
        css: this.banner
      }
    }

    if (!pathForFile(outfilePath)) {
      opts.outdir = outfilePath
    } else {
      if (infilePath.length > 1) {
        log({ tag: 'error', text: 'Cannot output multiple script files to a single file. Please specify an output directory path instead.' })
        process.exit(1)
      }
      opts.outfile = outfilePath
    }

    if (options.format) opts.format = options.format
    if (options.target) opts.target = options.target
    if (options.nodePaths) opts.nodePaths = [...new Set([...opts.nodePaths, ...options.nodePaths])]
    if (options.sourcemap) opts.sourcemap = options.sourcemap

    const optionsClone = { ...options }
    delete optionsClone.justMinified
    delete optionsClone.minify

    deepMerge(opts, optionsClone) // ability to pass other esbuild options `node_modules/esbuild/lib/main.d.ts`

    // Multi-dir entry points nest output under their common ancestor (esbuild's
    // outbase), so output paths can't be derived from basenames — read them
    // from the metafile instead. Keys are relative to absWorkingDir.
    opts.metafile = true
    opts.absWorkingDir = process.cwd()

    const esbuildStart = performance.now()
    let result
    try {
      result = await build(opts)
    } catch (err) {
      log({ tag, error: true, text: 'Failed compiling:', link: outfilePath })
      console.error(err)
      return
    }
    const esbuildEnd = performance.now()

    for (const [newOutFilePath, output] of Object.entries(result.metafile.outputs)) {
      if (!output.entryPoint) continue // sourcemaps, chunks

      if (!options.justMinified) log({ tag, text: 'Compiled:', link: newOutFilePath, size: fileSize(newOutFilePath), time: buildTime(esbuildStart, esbuildEnd) })
      if (options.sourcemap) log({ tag, text: 'Compiled:', link: `${newOutFilePath}.map` })

      await minifyToFile({ outfilePath: newOutFilePath, loader: 'js', banner: this.banner, tag, options })
    }
  }
}
