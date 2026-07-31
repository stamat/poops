import { build } from 'esbuild'
import { globSync, hasMagic } from 'glob'
import { deepMerge } from 'book-of-spells'
import {
  pathExists,
  mkDir,
  mkPath,
  pathForFile,
  isIndexEntry,
  globBase,
  indexEntryOut,
  entryBase,
  hasOutTemplate,
  outTemplateBase,
  fillOutTemplateEntry,
  fillBannerTemplate,
  buildTime,
  fileSize,
  DEFAULT_TARGET
} from './utils/helpers.js'
import path from 'node:path'
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
      const configured = Array.isArray(scriptEntry.in) ? scriptEntry.in : [scriptEntry.in]
      const entryPoints = []
      // A templated `out` names one output per entry point. esbuild already
      // takes a per-entry `out` relative to `outdir` — the same door the
      // `index.*` rename goes through — so the template resolves into that.
      const templated = hasOutTemplate(scriptEntry.out)
      const outBase = templated ? outTemplateBase(scriptEntry.out) : null
      let missing = false
      for (const entry of configured) {
        if (hasMagic(entry, { magicalBraces: true })) {
          // Globs must use `/` even on Windows; sort for deterministic build order
          const matches = globSync(entry, { posix: true }).sort()
          if (!matches.length) {
            log({ tag: 'script', error: true, text: 'Entry does not exist:', link: entry })
            missing = true
          }
          // A glob-matched `index.js` is named after its directory, relative to
          // the glob's static prefix — otherwise every component collides on
          // `index.js` or nests a level deep under esbuild's outbase. Literal
          // entries keep their basename — see `isIndexEntry`.
          const base = globBase(entry)
          entryPoints.push(...matches.map(match => {
            if (templated) return { in: match, out: fillOutTemplateEntry(scriptEntry.out, match, base, outBase) }
            return isIndexEntry(match) ? { in: match, out: indexEntryOut(match, base) } : match
          }))
        } else if (!pathExists(entry)) {
          log({ tag: 'script', error: true, text: 'Entry does not exist:', link: entry })
          missing = true
        } else if (templated) {
          entryPoints.push({ in: entry, out: fillOutTemplateEntry(scriptEntry.out, entry, entryBase(entry), outBase) })
        } else {
          entryPoints.push(entry)
        }
      }
      if (missing) continue
      let options = scriptEntry.options
      if (templated) {
        mkDir(outBase)
        // esbuild appends its own extension, so a template asking for one other
        // than `.js` has to be honoured through `outExtension` or it's ignored
        const ext = path.posix.extname(scriptEntry.out)
        if (ext && ext !== '.js') options = { outExtension: { '.js': ext }, ...options }
      } else {
        mkPath(scriptEntry.out)
      }
      await this.compileEntry(entryPoints, templated ? outBase : scriptEntry.out, options)
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
      target: DEFAULT_TARGET,
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
      // An explicit `outfile` names the output itself, so drop any `{ in, out }`
      // wrapper the glob resolver added — esbuild rejects the pair.
      opts.entryPoints = infilePath.map(entry => entry.in || entry)
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
