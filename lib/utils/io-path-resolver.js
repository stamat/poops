const path = require('node:path')
const glob = require('glob')
// const fs = require('node:fs')
const helpers = require('./helpers.js')
const { pathExists, pathForFile, pathIsDirectory } = helpers

/*
 * This module is responsible for resolving the input and output paths of the configuration segment, meaning Scripts, Styles or Markups.
 * It is designed do be used in the compile methods of these classes by resolving multiple input and output paths into configuration segment entries.
 * For instance, if the input path is a directory, it will be resolved into multiple input paths, one for each file in the directory.
 * If the output path is a directory, it will be resolved into multiple output paths, one for each input path.
 * It allows for the input and output paths to be specified as arrays, in which case the paths will be resolved in the same way.
 * It allows usage of glob patterns in the input path, which will be resolved into multiple input paths if output path is a directory.
 */
module.exports = function ioPathResolver(configSegment, type) {
  const result = []
  if (!configSegment) return result
  if (!Array.isArray(configSegment)) configSegment = [configSegment]

  let extensionGlobString = ''

  switch (type) {
    case 'ts':
      extensionGlobString = '{ts,tsx}'
      break
    case 'js':
      extensionGlobString = '{js,jsx}'
      break
    case 'sass':
      extensionGlobString = '{css,scss,sass}'
      break
    case 'less':
      extensionGlobString = '{css,less}'
      break
    case 'stylus':
      extensionGlobString = '{css,styl,stylus}'
      break
    case 'nunjucks':
      extensionGlobString = '{html,njk}'
      break
    case 'liquid':
      extensionGlobString = '{html,liquid}'
      break
    case 'ejs':
      extensionGlobString = '{html,ejs}'
      break
  }

  if (type) extensionGlobString = `*.{${extensionGlobString}}`

  for (const entry of configSegment) {
    if (!entry.in) continue
    if (!entry.out) entry.out = '/'
    if (!Array.isArray(entry.in)) entry.in = [entry.in]

    for (const inPath of entry.in) {
      if (pathIsDirectory(inPath)) {
        const files = glob.sync(path.join(inPath, path.join('**', extensionGlobString)))
        for (const file of files) {
          const outPath = path.join(entry.out, path.relative(inPath, file))
          result.push({ in: file, out: outPath, options: entry.options })
        }
      } else {
        const outPath = pathForFile(entry.out) ? entry.out : path.join(entry.out, path.basename(inPath))
        result.push({ in: inPath, out: outPath, options: entry.options })
      }
    }
  }

  return result
}
