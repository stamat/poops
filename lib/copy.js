import { globSync, hasMagic } from 'glob'
import {
  pathExists,
  pathIsDirectory,
  mkDir,
  copyDirectory,
  buildTime
} from './utils/helpers.js'
import fs from 'node:fs'
import path from 'node:path'
import PrintStyle from './utils/print-style.js'

const pstyle = new PrintStyle()

export default class Copy {
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

  async unlink(file, copyPaths) {
    if (!file || !copyPaths) return
    if (!copyPaths.out || !copyPaths.in) return
    if (!pathExists(copyPaths.out) || !pathExists(copyPaths.in)) return

    if (pathIsDirectory(copyPaths.in)) {
      const inBaseName = path.basename(copyPaths.in)
      copyPaths.out = path.join(copyPaths.out, inBaseName)
    }

    file = file.replace(copyPaths.in, copyPaths.out)

    const outputFilePath = path.join(process.cwd(), file)

    if (pathExists(outputFilePath)) {
      if (pathIsDirectory(outputFilePath)) {
        fs.rmdirSync(outputFilePath, { recursive: true })
        return
      }
      fs.unlinkSync(outputFilePath)
    }
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
