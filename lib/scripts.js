const { build } = require('esbuild')
const deepmerge = require('deepmerge')
const helpers = require('./utils/helpers.js')
const fs = require('node:fs')
const Style = require('./utils/style.js')
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

const style = new Style()

module.exports = class Scripts {
  constructor(config) {
    this.config = config
    this.banner = fillBannerTemplate(config.banner, config.pkg)
  }

  compile() {
    if (!this.config.scripts) return
    this.config.scripts = Array.isArray(this.config.scripts) ? this.config.scripts : [this.config.scripts]
    for (const scriptEntry of this.config.scripts) {
      if (scriptEntry.in && scriptEntry.out && pathExists(scriptEntry.in)) {
        mkPath(scriptEntry.out)
        this.compileEntry(scriptEntry.in, scriptEntry.out, scriptEntry.options)
      }
    }
  }

  compileEntry(infilePath, outfilePath, options = {}) {
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
        console.log(`${style.redBright + style.bold}[error]${style.reset} Cannot output multiple ${style.bold + style.underline}script${style.reset} files to a single file. Please specify an output directory path instead.`)
        process.exit(1)
      }
      opts.outfile = outfilePath
    }

    if (options.format) opts.format = options.format
    if (options.target) opts.target = options.target
    if (options.nodePaths) opts.nodePaths = [...new Set([...opts.nodePaths, ...options.nodePaths])]
    if (options.sourcemap) opts.sourcemap = options.sourcemap

    if (options.mangle) terserOpts.mangle = options.mangle

    delete options.mangle
    deepmerge(opts, options) // ability to pass other esbuild options `node_modules/esbuild/lib/main.d.ts`

    // TODO: Actually loop the build process for each entry point!!!
    const esbuildStart = performance.now()
    build(opts).then(() => {
      const esbuildEnd = performance.now()
      for (const entry of infilePath) {
        const newOutFilePath = buildScriptOutputFilePath(entry, outfilePath)
        const minPath = insertMinSuffix(newOutFilePath)

        if (!options.justMinified) console.log(`${style.yellowBright + style.bold}[script]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${newOutFilePath}${style.reset} ${style.greenBright}${fileSize(newOutFilePath)}${style.reset} ${style.green}(${buildTime(esbuildStart, esbuildEnd)})${style.reset}`)
        if (options.sourcemap) console.log(`${style.yellowBright + style.bold}[script]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${newOutFilePath}.map${style.reset}`)

        if (options.minify) {
          const terserStart = performance.now()
          Terser.minify(fs.readFileSync(newOutFilePath, 'utf-8'), { mangle: terserOpts.mangle }).then((result) => {
            if (result.error) {
              console.log(`${style.redBright + style.bold}[error]${style.reset} Error occurred during JS minification: ${style.dim}${result.error}${style.reset}`)
            } else {
              if (this.banner) result.code = this.banner + '\n' + result.code
              fs.writeFileSync(minPath, result.code)
              const terserEnd = performance.now()
              console.log(`${style.yellowBright + style.bold}[script]${style.reset} ${style.dim}Compiled:${style.reset} ${style.italic + style.underline}${minPath}${style.reset} ${style.greenBright}${fileSize(minPath)}${style.reset} ${style.green}(${buildTime(terserStart, terserEnd)})${style.reset}`)
            }
          })

          if (options.justMinified) {
            fs.unlinkSync(newOutFilePath)
          }
        } else {
          fs.unlinkSync(minPath)
        }
      }
    })
  }
}
