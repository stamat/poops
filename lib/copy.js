import { globSync, hasMagic } from 'glob'
import {
  pathExists,
  pathIsDirectory,
  mkDir,
  copyDirectory,
  buildTime,
  toPosix
} from './utils/helpers.js'
import fs from 'node:fs'
import path from 'node:path'
import log from './utils/log.js'

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
        log({ tag: 'copy', error: true, text: `Cannot copy. Missing 'in' or 'out' property in copy entry: ${JSON.stringify(copyEntry)}` })
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
              log({ tag: 'copy', error: true, text: 'Cannot copy. Source path does not exist:', link: matchedPath })
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
            log({ tag: 'copy', error: true, text: 'No files matched glob pattern:', link: inEntry })
          } else {
            log({ tag: 'copy', error: true, text: 'Cannot copy. Source path does not exist:', link: inEntry })
          }
        }
      }
    }

    const copyEndTime = performance.now()
    if (copyPathCount === 0) return
    if (copyPathCount === 1) {
      log({ tag: 'copy', text: 'Copied', link: copyLastPath, time: buildTime(copyStartTime, copyEndTime) })
      return
    }

    log({ tag: 'copy', text: `Copied ${copyPathCount} paths`, time: buildTime(copyStartTime, copyEndTime) })
  }

  async unlink(file, copyPaths) {
    if (!file || !copyPaths) return
    if (!copyPaths.out || !copyPaths.in) return
    if (!pathExists(copyPaths.out) || !pathExists(copyPaths.in)) return

    if (pathIsDirectory(copyPaths.in)) {
      const inBaseName = path.basename(copyPaths.in)
      copyPaths.out = path.join(copyPaths.out, inBaseName)
    }

    // Watcher paths arrive with native separators, config `in` uses `/`
    file = toPosix(file).replace(copyPaths.in, copyPaths.out)

    const outputFilePath = path.resolve(process.cwd(), file)

    if (pathExists(outputFilePath)) {
      if (pathIsDirectory(outputFilePath)) {
        fs.rmSync(outputFilePath, { recursive: true })
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
