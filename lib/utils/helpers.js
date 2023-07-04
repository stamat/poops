const fs = require('node:fs')
const path = require('node:path')

function pathExists() {
  return fs.existsSync(path.join(...arguments))
}

function pathIsDirectory() {
  return fs.lstatSync(path.join(...arguments)).isDirectory()
}

function mkPath(filePath) {
  const dirPath = path.dirname(filePath)
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function pathForFile(filePath) {
  return /\./.test(path.basename(filePath))
}

function insertMinSuffix(filePath) {
  const { name, ext } = path.parse(filePath)
  return path.join(path.dirname(filePath), `${name}.min${ext}`)
}

function buildStyleOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name } = path.parse(inputPath)
  return path.join(path.join(outputPath, `${name}.css`))
}

function buildScriptOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name, ext } = path.parse(inputPath)
  return path.join(path.join(outputPath, `${name}${ext.replace('t', 'j')}`))
}

function fillBannerTemplate(template, packagesPath) {
  packagesPath = packagesPath || process.cwd()
  const packagesFilePath = path.join(packagesPath, 'package.json')
  if (!pathExists(packagesFilePath)) return template
  const pkg = require(packagesFilePath)
  const { name, version, homepage, description, license, author } = pkg
  const year = new Date().getFullYear()

  return template
    .replace(/{{\s?name\s?}}/g, name)
    .replace(/{{\s?version\s?}}/g, version)
    .replace(/{{\s?homepage\s?}}/g, homepage)
    .replace(/{{\s?description\s?}}/g, description)
    .replace(/{{\s?author\s?}}/g, author)
    .replace(/{{\s?license\s?}}/g, license)
    .replace(/{{\s?year\s?}}/g, year)
}

function buildTime(start, end) {
  const time = Math.round(end - start)
  if (time < 1000) return `${time}ms`
  if (time < 60 * 1000) return `${(time / 1000).toFixed(0)}s ${time % 1000}ms`
  return `${(time / 1000 / 60).toFixed(0)}m ${((time / 1000) % 60).toFixed(0)}s ${time % 1000}ms`
}

function fileSize(filePath) {
  const stats = fs.statSync(filePath)
  const fileSizeInBytes = stats.size
  if (fileSizeInBytes < 1000) return `${fileSizeInBytes}B`
  if (fileSizeInBytes < 1000 * 1000) return `${(fileSizeInBytes / 1000).toFixed(0)}KB`
  if (fileSizeInBytes < 1000 * 1000 * 1000) return `${(fileSizeInBytes / 1000 / 1000).toFixed(0)}MB ${fileSizeInBytes % (1000 * 1000)}KB`
  return fileSizeInBytes
}

exports.pathExists = pathExists
exports.pathIsDirectory = pathIsDirectory
exports.mkPath = mkPath
exports.pathForFile = pathForFile
exports.insertMinSuffix = insertMinSuffix
exports.buildStyleOutputFilePath = buildStyleOutputFilePath
exports.buildScriptOutputFilePath = buildScriptOutputFilePath
exports.fillBannerTemplate = fillBannerTemplate
exports.buildTime = buildTime
exports.fileSize = fileSize
