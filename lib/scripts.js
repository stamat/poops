const { buildSync } = require('esbuild')
const deepmerge = require('deepmerge')
const helpers = require('./utils/helpers.js')
const fs = require('node:fs')
const PrintStyle = require('./utils/print-style.js')
const Terser = require('terser')

const {
  pathExists,
  mkPath,
  pathForFile,
  insertMinSuffix,
  buildScriptOutputFilePath,
  fillBannerTemplate,
  buildTime,
  fileSize
} = helpers

const pstyle = new PrintStyle()

module.exports = class Scripts {
  constructor(config) {
    this.config = config
    this.banner = fillBannerTemplate(config.banner, config.pkg)
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

    const terserOpts = {
      mangle: false
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
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} Cannot output multiple ${pstyle.bold + pstyle.underline}script${pstyle.reset} files to a single file. Please specify an output directory path instead.`)
        process.exit(1)
      }
      opts.outfile = outfilePath
    }

    if (options.format) opts.format = options.format
    if (options.target) opts.target = options.target
    if (options.nodePaths) opts.nodePaths = [...new Set([...opts.nodePaths, ...options.nodePaths])]
    if (options.sourcemap) opts.sourcemap = options.sourcemap

    if (options.mangle) terserOpts.mangle = options.mangle

    const optionsClone = { ...options }
    delete optionsClone.justMinified
    delete optionsClone.minify
    delete optionsClone.mangle

    // TODO: Use my own implementation of deepmerge to reduce dependencies, and also my own deepclone
    deepmerge(opts, optionsClone) // ability to pass other esbuild options `node_modules/esbuild/lib/main.d.ts`

    // TODO: Actually loop the build process for each entry point!!!
    const esbuildStart = performance.now()
    try {
      buildSync(opts)
    } catch (err) {
      console.log(`${pstyle.yellowBright + pstyle.bold}[script]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${outfilePath}${pstyle.reset + pstyle.bell}`)
      console.log(err)
    }
    const esbuildEnd = performance.now()

    for (const entry of infilePath) {
      const newOutFilePath = buildScriptOutputFilePath(entry, outfilePath)
      const minPath = insertMinSuffix(newOutFilePath)

      if (!options.justMinified) console.log(`${pstyle.yellowBright + pstyle.bold}[script]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${newOutFilePath}${pstyle.reset} ${pstyle.greenBright}${fileSize(newOutFilePath)}${pstyle.reset} ${pstyle.green}(${buildTime(esbuildStart, esbuildEnd)})${pstyle.reset}`)
      if (options.sourcemap) console.log(`${pstyle.yellowBright + pstyle.bold}[script]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${newOutFilePath}.map${pstyle.reset}`)

      if (options.minify) {
        // TODO: Use esbuild transformSync instead of Terser here. Make sync things great again!
        const terserStart = performance.now()
        const minifyResult = await Terser.minify(fs.readFileSync(newOutFilePath, 'utf-8'), terserOpts)
        const terserEnd = performance.now()

        if (minifyResult.error) {
          console.log(`${pstyle.yellowBright + pstyle.bold}[script]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset + pstyle.bell}`)
          console.log(minifyResult.error)
        } else {
          if (this.banner) minifyResult.code = this.banner + '\n' + minifyResult.code
          fs.writeFileSync(minPath, minifyResult.code)
          console.log(`${pstyle.yellowBright + pstyle.bold}[script]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset} ${pstyle.greenBright}${fileSize(minPath)}${pstyle.reset} ${pstyle.green}(${buildTime(terserStart, terserEnd)})${pstyle.reset}`)
        }

        if (options.justMinified) {
          fs.unlinkSync(newOutFilePath)
        }
      } else {
        fs.unlinkSync(minPath)
      }
    }
  }
}
