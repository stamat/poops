import fs from 'node:fs'
import {
  pathExists,
  mkPath,
  buildStyleOutputFilePath,
  fillBannerTemplate,
  buildTime,
  fileSize
} from './utils/helpers.js'
import minifyToFile from './utils/minify.js'
import log from './utils/log.js'

let postcss

async function loadPostCSS() {
  if (postcss) return true
  try {
    postcss = (await import('postcss')).default
    return true
  } catch (err) {
    log({ tag: 'postcss', error: true, text: 'Missing dependency. Install: npm i -D postcss' })
    return false
  }
}

async function resolvePlugins(plugins) {
  if (!plugins || !plugins.length) return []

  const resolved = []
  for (const plugin of plugins) {
    if (typeof plugin === 'string') {
      try {
        const mod = await import(plugin)
        resolved.push((mod.default || mod)())
      } catch (err) {
        log({ tag: 'postcss', error: true, text: `Failed to load plugin: ${plugin}` })
        throw err
      }
    } else if (Array.isArray(plugin)) {
      const [name, options] = plugin
      try {
        const mod = await import(name)
        resolved.push((mod.default || mod)(options))
      } catch (err) {
        log({ tag: 'postcss', error: true, text: `Failed to load plugin: ${name}` })
        throw err
      }
    } else {
      resolved.push(plugin)
    }
  }
  return resolved
}

export default class PostCSS {
  constructor(config) {
    this.config = config
    this.banner = config.banner ? fillBannerTemplate(config.banner) : null
  }

  async compile() {
    if (!this.config.postcss) return
    if (!(await loadPostCSS())) return

    this.config.postcss = Array.isArray(this.config.postcss) ? this.config.postcss : [this.config.postcss]
    for (const entry of this.config.postcss) {
      if (!entry.in || !entry.out) continue
      if (!pathExists(entry.in)) {
        log({ tag: 'postcss', error: true, text: 'Entry does not exist:', link: entry.in })
        continue
      }
      mkPath(entry.out)
      await this.compileEntry(entry.in, entry.out, entry.options)
    }
  }

  async compileEntry(infilePath, outfilePath, options = {}) {
    outfilePath = buildStyleOutputFilePath(infilePath, outfilePath)

    const input = fs.readFileSync(infilePath, 'utf-8')
    const start = performance.now()

    let result
    try {
      const plugins = await resolvePlugins(options.plugins)
      const processor = postcss(plugins)
      result = await processor.process(input, {
        from: infilePath,
        to: outfilePath
      })
    } catch (err) {
      log({ tag: 'postcss', error: true, text: 'Failed compiling:', link: outfilePath })
      console.error(err)
      return
    }

    let css = result.css
    if (this.banner) css = this.banner + '\n' + css
    fs.writeFileSync(outfilePath, css)
    const end = performance.now()
    if (!options.justMinified) log({ tag: 'postcss', text: 'Compiled:', link: outfilePath, size: fileSize(outfilePath), time: buildTime(start, end) })

    await minifyToFile({
      outfilePath,
      loader: 'css',
      code: css,
      banner: this.banner,
      tag: 'postcss',
      options,
      startTime: options.justMinified ? start : undefined
    })
  }
}
