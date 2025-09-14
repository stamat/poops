const helpers = require('./utils/helpers.js')
const path = require('node:path')
const PrintStyle = require('./utils/print-style.js')

const {
  pathExists,
  pathIsDirectory,
  mkDir,
  copyDirectory
} = helpers

const pstyle = new PrintStyle()

module.exports = class Copy {
  constructor(config) {
    this.config = config
  }

  async execute() {
    if (!this.config.copy) return
    this.config.copy = Array.isArray(this.config.copy) ? this.config.copy : [this.config.copy]

    for (const copyEntry of this.config.copy) {
      if (!copyEntry.in || !copyEntry.out) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}[copy] ${pstyle.dim}Cannot copy. Missing 'in' or 'out' property in copy entry:${pstyle.reset} ${JSON.stringify(copyEntry)}`)
        continue
      }

      const outPath = path.resolve(process.cwd(), copyEntry.out)

      if (Array.isArray(copyEntry.in)) {
        for (const inEntry of copyEntry.in) {
          if (pathExists(inEntry)) {
            await this.copyEntry(inEntry, outPath)
          } else {
            console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}[copy] ${pstyle.dim}Cannot copy. Source path does not exist:${pstyle.reset} ${inEntry.in}`)
          }
        }

        continue
      }

      if (pathExists(copyEntry.in)) {
        await this.copyEntry(copyEntry.in, outPath)
      } else {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}[copy] ${pstyle.dim}Cannot copy. Source path does not exist:${pstyle.reset} ${copyEntry.in}`)
      }
    }
  }

  async copyEntry(infilePath, outfilePath) {
    const baseName = path.basename(infilePath)
    let outPath = outfilePath
    mkDir(outfilePath)

    if (pathIsDirectory(outfilePath)) {
      outPath = path.join(outfilePath, baseName)
    }
    copyDirectory(infilePath, outPath)
  }
}
