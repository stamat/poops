import { transform } from 'esbuild'
import fs from 'node:fs'
import { pathExists, insertMinSuffix, fileSize, buildTime } from './helpers.js'
import log from './log.js'

/**
 * Shared post-compile minify step: writes `<name>.min<ext>` next to
 * `outfilePath`, deletes the unminified file when `options.justMinified`,
 * or deletes a stale `.min` file when minify is off.
 *
 * @param {Object} params
 * @param {string} params.outfilePath - Compiled (unminified) output file
 * @param {'js'|'css'} params.loader - esbuild transform loader
 * @param {string} [params.code] - Source to minify; read from outfilePath when omitted
 * @param {string} [params.banner] - Banner prepended to the minified code
 * @param {string} params.tag - Log tag
 * @param {Object} [params.options] - Entry options (`minify`, `justMinified`)
 * @param {number} [params.startTime] - Timing start override (justMinified logs include compile time)
 */
export default async function minifyToFile({ outfilePath, loader, code, banner, tag, options = {}, startTime }) {
  const minPath = insertMinSuffix(outfilePath)

  if (!options.minify) {
    if (pathExists(minPath)) fs.unlinkSync(minPath)
    return
  }

  try {
    const start = startTime ?? performance.now()
    if (code == null) code = fs.readFileSync(outfilePath, 'utf-8')
    const minified = await transform(code, { loader, minify: true })
    if (banner) minified.code = banner + '\n' + minified.code
    fs.writeFileSync(minPath, minified.code)
    log({ tag, text: 'Compiled:', link: minPath, size: fileSize(minPath), time: buildTime(start, performance.now()) })
  } catch (err) {
    log({ tag, error: true, text: 'Failed compiling:', link: minPath })
    console.error(err)
  }

  if (options.justMinified) fs.unlinkSync(outfilePath)
}
