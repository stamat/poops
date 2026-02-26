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
import { createRequire } from 'node:module'
import log from './utils/log.js'

export default class SSG {
  constructor(config) {
    this.config = config
    this.rendered = {}
    this.banner = config.banner ? fillBannerTemplate(config.banner, config.pkg) : null
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
    const tmpWrapper = component.replace(/(\.[^.]+)$/, `.ssg-tmp-${inject}$1`)
    const tmpBundle = component.replace(/(\.[^.]+)$/, `.ssg-bundle-${inject}.cjs`)

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

      const bundlePath = path.resolve(tmpBundle)
      const require = createRequire(import.meta.url)
      delete require.cache[bundlePath]
      const mod = require(bundlePath)
      this.rendered[inject] = mod.html
      const ssgEnd = performance.now()

      log({ tag: 'ssg', text: `Rendered: ${component} →`, link: inject, time: buildTime(ssgStart, ssgEnd) })
    } catch (err) {
      log({ tag: 'ssg', error: true, text: 'Failed rendering:', link: component })
      console.error(err)
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
        log({ tag: 'ssg', error: true, text: 'Failed compiling client:', link: out })
        console.error(err)
        return
      }
      const esbuildEnd = performance.now()

      if (!options.justMinified) log({ tag: 'ssg', text: 'Compiled:', link: out, size: fileSize(out), time: buildTime(esbuildStart, esbuildEnd) })
      if (options.sourcemap) log({ tag: 'ssg', text: 'Compiled:', link: `${out}.map` })

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
          log({ tag: 'ssg', text: 'Compiled:', link: minPath, size: fileSize(minPath), time: buildTime(terserStart, terserEnd) })
        } catch (err) {
          log({ tag: 'ssg', error: true, text: 'Failed compiling:', link: minPath })
          console.error(err)
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
