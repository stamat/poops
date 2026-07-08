import { build } from 'esbuild'
import { deepMerge } from 'book-of-spells'
import {
  pathExists,
  mkPath,
  pathContainsPathSegment,
  fillBannerTemplate,
  buildTime,
  fileSize
} from './utils/helpers.js'
import minifyToFile from './utils/minify.js'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import log from './utils/log.js'

export default class Reactor {
  constructor(config) {
    this.config = config
    this.rendered = {}
    this.renderedChanged = false
    this.banner = config.banner ? fillBannerTemplate(config.banner, config.pkg) : null
  }

  async compile() {
    if (!this.config.reactor) return
    this.config.reactor = Array.isArray(this.config.reactor) ? this.config.reactor : [this.config.reactor]
    const prevRendered = this.rendered
    this.rendered = {}

    for (const entry of this.config.reactor) {
      if (!entry.component || !entry.inject) continue
      if (!pathExists(entry.component)) {
        log({ tag: 'reactor', error: true, text: 'Component does not exist:', link: entry.component })
        continue
      }
      await this.compileEntry(entry)
    }

    this.renderedChanged = JSON.stringify(this.rendered) !== JSON.stringify(prevRendered)
  }

  async compileEntry(entry) {
    const { component, in: client, out, inject, options = {} } = entry

    // --- Step 1: Server-side render the component ---
    const tmpWrapper = component.replace(/(\.[^.]+)$/, `.reactor-tmp-${inject}$1`)
    const tmpBundle = component.replace(/(\.[^.]+)$/, `.reactor-bundle-${inject}.cjs`)

    const wrapperCode = `
import { renderToString } from 'react-dom/server';
import React from 'react';
import Component from './${path.basename(component)}';
export const html = renderToString(React.createElement(Component));
`

    try {
      fs.writeFileSync(tmpWrapper, wrapperCode)

      const renderStart = performance.now()
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
      const renderEnd = performance.now()

      log({ tag: 'reactor', text: `Rendered: ${component} →`, link: inject, time: buildTime(renderStart, renderEnd) })
    } catch (err) {
      log({ tag: 'reactor', error: true, text: 'Failed rendering:', link: component })
      console.error(err)
    } finally {
      if (fs.existsSync(tmpWrapper)) fs.unlinkSync(tmpWrapper)
      if (fs.existsSync(tmpBundle)) fs.unlinkSync(tmpBundle)
    }

    // --- Step 2: Bundle the client entry for the browser ---
    if (client && out && !pathExists(client)) {
      log({ tag: 'reactor', error: true, text: 'Entry does not exist:', link: client })
    }
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
        log({ tag: 'reactor', error: true, text: 'Failed compiling client:', link: out })
        console.error(err)
        return
      }
      const esbuildEnd = performance.now()

      if (!options.justMinified) log({ tag: 'reactor', text: 'Compiled:', link: out, size: fileSize(out), time: buildTime(esbuildStart, esbuildEnd) })
      if (options.sourcemap) log({ tag: 'reactor', text: 'Compiled:', link: `${out}.map` })

      await minifyToFile({ outfilePath: out, loader: 'js', banner: this.banner, tag: 'reactor', options })
    }
  }

  getRendered() {
    return this.rendered
  }

  belongsToReactor(file) {
    if (!this.config.reactor) return false
    const entries = Array.isArray(this.config.reactor) ? this.config.reactor : [this.config.reactor]
    return entries.some(e => e.component && pathContainsPathSegment(file, path.dirname(e.component)))
  }
}
