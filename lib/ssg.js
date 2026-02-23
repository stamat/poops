import { build, transform } from 'esbuild'
import { deepMerge } from 'book-of-spells'
import {
  pathExists,
  mkPath,
  insertMinSuffix,
  fillBannerTemplate,
  buildTime,
  fileSize
} from './utils/helpers.js'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import PrintStyle from './utils/print-style.js'

const pstyle = new PrintStyle()

export default class SSG {
  constructor(config) {
    this.config = config
    this.rendered = {}
    this.banner = fillBannerTemplate(config.banner, config.pkg)
  }

  async compile() {
    if (!this.config.ssg) return
    this.config.ssg = Array.isArray(this.config.ssg) ? this.config.ssg : [this.config.ssg]
    this.rendered = {}

    for (const entry of this.config.ssg) {
      if (entry.component && entry.inject && pathExists(entry.component)) {
        await this.compileEntry(entry)
      }
    }
  }

  async compileEntry(entry) {
    const { component, in: client, out, inject, options = {} } = entry

    // --- Step 1: Server-side render the component ---
    const tmpWrapper = component.replace(/(\.[^.]+)$/, '.ssg-tmp$1')
    const tmpBundle = component.replace(/(\.[^.]+)$/, '.ssg-bundle.cjs')

    const wrapperCode = `
import { renderToString } from 'react-dom/server';
import React from 'react';
import Component from './${path.basename(component)}';
export const html = renderToString(React.createElement(Component));
`

    try {
      fs.writeFileSync(tmpWrapper, wrapperCode)

      const ssgStart = performance.now()
      await build({
        logLevel: 'error',
        entryPoints: [tmpWrapper],
        outfile: tmpBundle,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        jsx: 'automatic',
        nodePaths: this.config.includePaths
      })

      const bundleUrl = pathToFileURL(path.resolve(tmpBundle)).href
      const mod = await import(`${bundleUrl}?t=${Date.now()}`)
      this.rendered[inject] = mod.html
      const ssgEnd = performance.now()

      console.log(`${pstyle.yellowBright + pstyle.bold}[ssg]${pstyle.reset} ${pstyle.dim}Rendered:${pstyle.reset} ${pstyle.italic + pstyle.underline}${component}${pstyle.reset} → ${pstyle.bold}${inject}${pstyle.reset} ${pstyle.green}(${buildTime(ssgStart, ssgEnd)})${pstyle.reset}`)
    } catch (err) {
      console.log(`${pstyle.yellowBright + pstyle.bold}[ssg]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed rendering:${pstyle.reset} ${pstyle.italic + pstyle.underline}${component}${pstyle.reset + pstyle.bell}`)
      console.log(err)
    } finally {
      if (fs.existsSync(tmpWrapper)) fs.unlinkSync(tmpWrapper)
      if (fs.existsSync(tmpBundle)) fs.unlinkSync(tmpBundle)
    }

    // --- Step 2: Bundle the client entry for the browser ---
    if (client && out && pathExists(client)) {
      mkPath(out)

      const opts = {
        logLevel: 'error',
        entryPoints: [client],
        outfile: out,
        bundle: true,
        sourcemap: false,
        minify: false,
        format: 'iife',
        target: 'es2019',
        nodePaths: this.config.includePaths
      }

      if (this.banner) {
        opts.banner = {
          js: this.banner,
          css: this.banner
        }
      }

      if (options.format) opts.format = options.format
      if (options.target) opts.target = options.target
      if (options.nodePaths) opts.nodePaths = [...new Set([...opts.nodePaths, ...options.nodePaths])]
      if (options.sourcemap) opts.sourcemap = options.sourcemap

      const optionsClone = { ...options }
      delete optionsClone.justMinified
      delete optionsClone.minify

      deepMerge(opts, optionsClone)

      const esbuildStart = performance.now()
      try {
        await build(opts)
      } catch (err) {
        console.log(`${pstyle.yellowBright + pstyle.bold}[ssg]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed compiling client:${pstyle.reset} ${pstyle.italic + pstyle.underline}${out}${pstyle.reset + pstyle.bell}`)
        console.log(err)
        return
      }
      const esbuildEnd = performance.now()

      if (!options.justMinified) console.log(`${pstyle.yellowBright + pstyle.bold}[ssg]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${out}${pstyle.reset} ${pstyle.greenBright}${fileSize(out)}${pstyle.reset} ${pstyle.green}(${buildTime(esbuildStart, esbuildEnd)})${pstyle.reset}`)
      if (options.sourcemap) console.log(`${pstyle.yellowBright + pstyle.bold}[ssg]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${out}.map${pstyle.reset}`)

      if (options.minify) {
        const minPath = insertMinSuffix(out)
        try {
          const terserStart = performance.now()
          const minifyResult = await transform(fs.readFileSync(out, 'utf-8'), {
            minify: true,
            loader: 'js'
          })
          const terserEnd = performance.now()

          if (this.banner) minifyResult.code = this.banner + '\n' + minifyResult.code
          fs.writeFileSync(minPath, minifyResult.code)
          console.log(`${pstyle.yellowBright + pstyle.bold}[ssg]${pstyle.reset} ${pstyle.dim}Compiled:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset} ${pstyle.greenBright}${fileSize(minPath)}${pstyle.reset} ${pstyle.green}(${buildTime(terserStart, terserEnd)})${pstyle.reset}`)
        } catch (err) {
          console.log(`${pstyle.yellowBright + pstyle.bold}[ssg]${pstyle.reset} ${pstyle.redBright}[error]${pstyle.reset} ${pstyle.dim}Failed compiling:${pstyle.reset} ${pstyle.italic + pstyle.underline}${minPath}${pstyle.reset + pstyle.bell}`)
          console.log(err)
        }

        if (options.justMinified) {
          fs.unlinkSync(out)
        }
      } else {
        const minPath = insertMinSuffix(out)
        if (pathExists(minPath)) fs.unlinkSync(minPath)
      }
    }
  }

  getRendered() {
    return this.rendered
  }
}
