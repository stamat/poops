const fs = require('node:fs')
const glob = require('glob')
const path = require('node:path')

function pathExists() {
  return fs.existsSync(path.join(...arguments))
}

function pathIsDirectory() {
  return fs.lstatSync(path.join(...arguments)).isDirectory()
}

function mkDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function mkPath(filePath) {
  const dirPath = path.dirname(filePath)
  mkDir(dirPath)
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

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readYamlFile(filePath) {
  try {
    return require('yaml').parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`Error reading YAML file at ${filePath}:`, e)
    return null
  }
}

function parseFrontMatter(filePath) {
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    throw new Error(`Error reading file at ${filePath}: ${e.message}`)
  }

  if (!content) {
    throw new Error(`File at ${filePath} is empty`)
  }

  const frontMatterRegex = /^\s*---\s*[\r\n]+([\s\S]*?)\s*---\s*[\r\n]+/
  const match = content.match(frontMatterRegex)
  if (!match) return { frontMatter: {}, content }
  let frontMatter = {}
  try {
    frontMatter = require('yaml').parse(match[1])
  } catch (e) {
    throw new Error(`Error parsing front matter in file at ${filePath}: ${e.message}`)
  }
  const contentWithoutFrontMatter = content.slice(match[0].length)
  return { frontMatter, content: contentWithoutFrontMatter }
}

function readDataFile(filePath) {
  if (/(\.json)$/i.test(filePath)) return readJsonFile(filePath)
  if (/(\.ya?ml)$/i.test(filePath)) return readYamlFile(filePath)
  return fs.readFileSync(filePath, 'utf8')
}

function deleteDirectoryContents(directory) {
  if (!pathExists(directory)) return
  const files = fs.readdirSync(directory)

  for (const file of files) {
    const filePath = path.join(directory, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      deleteDirectoryContents(filePath)
      fs.rmdirSync(filePath)
    } else {
      fs.unlinkSync(filePath)
    }
  }
}

function deleteDirectory(directory) {
  if (!pathExists(directory)) return
  deleteDirectoryContents(directory)
  fs.rmdirSync(directory)
}

function copyDirectory(src, dest) {
  if (!pathExists(src)) return

  if (!pathIsDirectory(src)) {
    fs.copyFileSync(src, dest)
    return
  }

  mkDir(dest)

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function convertGlobToRegex(glob) {
  let regexString = ''
  const charMap = {
    '*': '[^\\/\\\\]*',
    '?': '[^\\/\\\\]',
    '!': '^',
    '{': '(',
    '}': ')',
    ',': '|',
    '.': '\\.',
    '-': '\\-',
    // eslint-disable-next-line quote-props
    '$': '\\$',
    '+': '\\+',
    '/': '\\/',
    '\\': '\\\\'
  }
  let insideSquareBrackets = false
  let insideCurlyBraces = false

  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    // eslint-disable-next-line no-prototype-builtins
    if (charMap.hasOwnProperty(char)) {
      let currentChar = charMap[char]
      if (char === '{') insideCurlyBraces = true
      if (char === '}') insideCurlyBraces = false
      if (char === '!' && !insideSquareBrackets) currentChar = '\\!' // Escape '!' outside square brackets
      if (char === ',' && !insideCurlyBraces) currentChar = '\\,' // Escape ',' outside curly braces
      if (insideSquareBrackets && char === '-') currentChar = char // Don't escape '-' inside square brackets
      regexString += currentChar
    } else {
      if (char === '[') insideSquareBrackets = true
      if (char === ']') insideSquareBrackets = false
      regexString += char
    }
  }

  let re = null

  try {
    re = new RegExp(regexString)
  } catch (e) {
    // Invalid regex
  }

  return re
}

function removeDirNavWildcards(filePath) {
  return path.normalize(filePath).replace(/(\.\.\/|\.\/|\/\.\.|\.\.\\|\.\\|\\\.\.)/g, '')
}

function pathContainsPathSegment(filePath, segment) {
  segment = removeDirNavWildcards(segment)
  if (glob.hasMagic(segment)) {
    segment = convertGlobToRegex(segment)
    if (!segment) return false
    return segment.test(filePath)
  } else {
    return filePath.includes(segment)
  }
}

function doesFileBelongToPath(filePath, configPaths) {
  if (!configPaths) return false
  if (!Array.isArray(configPaths)) configPaths = [configPaths]
  for (const configPath of configPaths) {
    if (!configPath.in) continue
    const configInPaths = Array.isArray(configPath.in) ? configPath.in : [configPath.in]
    for (const inPath of configInPaths) {
      if (pathContainsPathSegment(filePath, inPath)) return configPath
    }
  }
  return false
}

module.exports = {
  pathExists,
  pathIsDirectory,
  mkDir,
  mkPath,
  pathForFile,
  insertMinSuffix,
  buildStyleOutputFilePath,
  buildScriptOutputFilePath,
  fillBannerTemplate,
  buildTime,
  fileSize,
  readJsonFile,
  readYamlFile,
  readDataFile,
  deleteDirectoryContents,
  deleteDirectory,
  copyDirectory,
  doesFileBelongToPath,
  parseFrontMatter
}
