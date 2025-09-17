const { globSync, hasMagic } = require('glob')
const helpers = require('./utils/helpers.js')
const path = require('node:path')
const PrintStyle = require('./utils/print-style.js')

const {
  pathExists,
  pathIsDirectory,
  mkDir,
  copyDirectory,
  buildTime
} = helpers

const pstyle = new PrintStyle()

module.exports = class Copy {
  constructor(config) {
    this.config = config
  }

  async execute() {
    if (!this.config.copy) return
    const copyStartTime = performance.now()
    this.config.copy = Array.isArray(this.config.copy) ? this.config.copy : [this.config.copy]
    let copyLastPath = ''
    let copyPathCount = 0

    for (const copyEntry of this.config.copy) {
      if (!copyEntry.in || !copyEntry.out) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}[copy] ${pstyle.dim}Cannot copy. Missing 'in' or 'out' property in copy entry:${pstyle.reset} ${JSON.stringify(copyEntry)}`)
        continue
      }

      const outPath = path.resolve(process.cwd(), copyEntry.out)
      const inEntries = Array.isArray(copyEntry.in) ? copyEntry.in : [copyEntry.in]

      for (const inEntry of inEntries) {
        const hasGlobMagic = typeof hasMagic === 'function'
          ? hasMagic(inEntry)
          : ['*', '?', '[', ']', '{', '}', '(', ')', '!'].some((ch) => inEntry.includes(ch))
        let matches = []
        try {
          if (typeof globSync === 'function') {
            matches = globSync(inEntry, { dot: true, nodir: false })
          }
        } catch (err) {
          matches = []
        }

        if (matches.length > 0) {
          for (const matchedPath of matches) {
            if (pathExists(matchedPath)) {
              await this.copyEntry(matchedPath, outPath)
              copyLastPath = inEntry
              copyPathCount++
            } else {
              console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}[copy] ${pstyle.dim}Cannot copy. Source path does not exist:${pstyle.reset} ${matchedPath}`)
            }
          }
          continue
        }

        if (pathExists(inEntry)) {
          await this.copyEntry(inEntry, outPath)
          copyLastPath = inEntry
          copyPathCount++
        } else {
          if (hasGlobMagic) {
            console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}[copy] ${pstyle.dim}No files matched glob pattern:${pstyle.reset} ${inEntry}`)
          } else {
            console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}[copy] ${pstyle.dim}Cannot copy. Source path does not exist:${pstyle.reset} ${inEntry}`)
          }
        }
      }
    }

    const copyEndTime = performance.now()
    if (copyPathCount === 0) return
    if (copyPathCount === 1) {
      console.log(`${pstyle.green + pstyle.bold}[copy]${pstyle.reset} ${pstyle.dim}Copied${pstyle.reset} ${pstyle.italic + pstyle.underline}${copyLastPath}${pstyle.reset} ${pstyle.green}(${buildTime(copyStartTime, copyEndTime)})${pstyle.reset}`)
      return
    }

    console.log(`${pstyle.green + pstyle.bold}[copy]${pstyle.reset} ${pstyle.dim}Copied${pstyle.reset} ${copyPathCount} paths ${pstyle.green}(${buildTime(copyStartTime, copyEndTime)})${pstyle.reset}`)
  }

  async copyEntry(inFilePath, outFilePath) {
    const baseName = path.basename(inFilePath)
    let outPath = outFilePath
    mkDir(outFilePath)

    if (pathIsDirectory(outFilePath)) {
      outPath = path.join(outFilePath, baseName)
    }
    copyDirectory(inFilePath, outPath)
  }
}
