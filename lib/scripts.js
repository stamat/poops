import { build, transform } from 'esbuild'
import { deepMerge } from 'book-of-spells'
import {
  pathExists,
  mkPath,
  pathForFile,
  insertMinSuffix,
  buildScriptOutputFilePath,
  fillBannerTemplate,
  buildTime,
  fileSize
} from './utils/helpers.js'
import fs from 'node:fs'
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
      if (scriptEntry.in && scriptEntry.out && pathExists(scriptEntry.in)) {
        mkPath(scriptEntry.out)
        await this.compileEntry(scriptEntry.in, scriptEntry.out, scriptEntry.options)
      }
    }
  }

  async compileEntry(infilePath, outfilePath, options = {}) {
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

    const esbuildStart = performance.now()
    try {
      await build(opts)
    } catch (err) {
      log({ tag: 'script', error: true, text: 'Failed compiling:', link: outfilePath })
      console.error(err)
      return
    }
    const esbuildEnd = performance.now()

    for (const entry of infilePath) {
      const newOutFilePath = buildScriptOutputFilePath(entry, outfilePath)
      const minPath = insertMinSuffix(newOutFilePath)

      if (!options.justMinified) log({ tag: 'script', text: 'Compiled:', link: newOutFilePath, size: fileSize(newOutFilePath), time: buildTime(esbuildStart, esbuildEnd) })
      if (options.sourcemap) log({ tag: 'script', text: 'Compiled:', link: `${newOutFilePath}.map` })

      if (options.minify) {
        try {
          const terserStart = performance.now()
          const minifyResult = await transform(fs.readFileSync(newOutFilePath, 'utf-8'), {
            minify: true,
            loader: 'js'
          })
          const terserEnd = performance.now()

          if (this.banner) minifyResult.code = this.banner + '\n' + minifyResult.code
          fs.writeFileSync(minPath, minifyResult.code)
          log({ tag: 'script', text: 'Compiled:', link: minPath, size: fileSize(minPath), time: buildTime(terserStart, terserEnd) })
        } catch (err) {
          log({ tag: 'script', error: true, text: 'Failed compiling:', link: minPath })
          console.error(err)
        }

        if (options.justMinified) {
          fs.unlinkSync(newOutFilePath)
        }
      } else {
        if (pathExists(minPath)) fs.unlinkSync(minPath)
      }
    }
  }
}
