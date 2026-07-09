import log from './utils/log.js'

// Runs poops-images (https://github.com/stamat/poops-images) as a regular
// runner when a `config.images` block is present AND the package is installed.
// poops-images stays an optional peer dependency — sharp never becomes a hard
// dep of poops. The markup engines read the cache poops-images writes, so this
// runner must execute before markups.compile().
export default class Images {
  constructor(config) {
    this.config = config
    this.processor = null // lazily created on first compile()
    this.disabled = false // no images config, or poops-images not installed
  }

  async init() {
    if (this.processor || this.disabled) return
    if (!this.config.images) { this.disabled = true; return }

    let ImageProcessor
    try {
      ImageProcessor = (await import('poops-images')).default
    } catch (err) {
      // Native ESM throws ERR_MODULE_NOT_FOUND; CJS-style/jest resolvers throw
      // MODULE_NOT_FOUND. Either means the optional dep simply isn't installed.
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
        log({ tag: 'image', warn: true, text: 'images config found but poops-images is not installed — run: npm i poops-images' })
        this.disabled = true
        return
      }
      throw err
    }

    // Quiet by default inside poops — one summary line instead of per-image
    // logs drowning the other runners. Opt back in with "verbose": true.
    // A bad images config throws here, propagating to the build's step() so
    // the build is marked failed rather than silently skipping images.
    this.processor = new ImageProcessor({ verbose: false, ...this.config.images })
  }

  async compile() {
    await this.init()
    if (!this.processor) return
    const stats = await this.processor.processAll()
    // Route through poops' log so hasLoggedErrors() flips the build exit code.
    // Older poops-images without the errors field: undefined is falsy, no-op.
    if (stats.errors > 0) {
      log({ tag: 'image', error: true, text: `${stats.errors} image(s) failed to process` })
    }
  }

  // Watch mode: a deleted source image removes its generated variants + cache entry.
  async remove(file) {
    await this.init()
    if (!this.processor) return
    this.processor.removeSource(file)
  }
}
