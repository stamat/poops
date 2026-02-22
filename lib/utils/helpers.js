import fs from 'node:fs'
import { hasMagic } from 'glob'
import path from 'node:path'
import yaml from 'yaml'

const frontMatterCache = new Map()

export function pathExists() {
  return fs.existsSync(path.join(...arguments))
}

export function pathIsDirectory() {
  return fs.lstatSync(path.join(...arguments)).isDirectory()
}

export function mkDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

export function mkPath(filePath) {
  const dirPath = path.dirname(filePath)
  mkDir(dirPath)
}

export function pathForFile(filePath) {
  return /\./.test(path.basename(filePath))
}

export function insertMinSuffix(filePath) {
  const { name, ext } = path.parse(filePath)
  return path.join(path.dirname(filePath), `${name}.min${ext}`)
}

export function buildStyleOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name } = path.parse(inputPath)
  return path.join(path.join(outputPath, `${name}.css`))
}

export function buildScriptOutputFilePath(inputPath, outputPath) {
  if (pathForFile(outputPath)) return outputPath
  const { name, ext } = path.parse(inputPath)
  return path.join(path.join(outputPath, `${name}${ext.replace('t', 'j')}`))
}

export function fillBannerTemplate(template, packagesPath) {
  packagesPath = packagesPath || process.cwd()
  const packagesFilePath = path.join(packagesPath, 'package.json')
  if (!pathExists(packagesFilePath)) return template
  const pkg = JSON.parse(fs.readFileSync(packagesFilePath, 'utf-8'))
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

export function buildTime(start, end) {
  const time = Math.round(end - start)
  if (time < 1000) return `${time}ms`
  if (time < 60 * 1000) return `${(time / 1000).toFixed(0)}s ${time % 1000}ms`
  return `${(time / 1000 / 60).toFixed(0)}m ${((time / 1000) % 60).toFixed(0)}s ${time % 1000}ms`
}

export function fileSize(filePath) {
  const stats = fs.statSync(filePath)
  const fileSizeInBytes = stats.size
  if (fileSizeInBytes < 1000) return `${fileSizeInBytes}B`
  if (fileSizeInBytes < 1000 * 1000) return `${(fileSizeInBytes / 1000).toFixed(0)}KB`
  if (fileSizeInBytes < 1000 * 1000 * 1000) return `${(fileSizeInBytes / 1000 / 1000).toFixed(0)}MB ${fileSizeInBytes % (1000 * 1000)}KB`
  return fileSizeInBytes
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function readYamlFile(filePath) {
  try {
    return yaml.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`Error reading YAML file at ${filePath}:`, e)
    return null
  }
}

export function parseFrontMatter(filePath) {
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (e) {
    throw new Error(`Error stating file at ${filePath}: ${e.message}`)
  }

  const cached = frontMatterCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return { frontMatter: { ...cached.value.frontMatter }, content: cached.value.content }
  }

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

  if (!match) {
    const value = { frontMatter: {}, content }
    frontMatterCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, value })
    return { frontMatter: {}, content }
  }

  let frontMatter = {}
  try {
    frontMatter = yaml.parse(match[1])
  } catch (e) {
    throw new Error(`Error parsing front matter in file at ${filePath}: ${e.message}`)
  }

  const contentWithoutFrontMatter = content.slice(match[0].length)
  const value = { frontMatter, content: contentWithoutFrontMatter }
  frontMatterCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, value })
  return { frontMatter: { ...frontMatter }, content: contentWithoutFrontMatter }
}

export function clearFrontMatterCache(filePath) {
  if (!filePath) {
    frontMatterCache.clear()
    return
  }
  frontMatterCache.delete(filePath)
}

export function readDataFile(filePath) {
  if (/(\.json)$/i.test(filePath)) return readJsonFile(filePath)
  if (/(\.ya?ml)$/i.test(filePath)) return readYamlFile(filePath)
  return fs.readFileSync(filePath, 'utf8')
}

export function deleteDirectoryContents(directory) {
  if (!pathExists(directory)) return
  const files = fs.readdirSync(directory)

  for (const file of files) {
    const filePath = path.join(directory, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true })
    } else {
      fs.unlinkSync(filePath)
    }
  }
}

export function deleteDirectory(directory) {
  if (!pathExists(directory)) return
  fs.rmSync(directory, { recursive: true })
}

export function copyDirectory(src, dest) {
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

export function convertGlobToRegex(glob) {
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
      switch (char) {
        case '{':
          insideCurlyBraces = true
          break
        case '}':
          insideCurlyBraces = false
          break
        case '!':
          if (!insideSquareBrackets) currentChar = '\\!' // Escape '!' outside square brackets
          break
        case ',':
          if (!insideCurlyBraces) currentChar = '\\,' // Escape ',' outside curly braces
          break
        case '-':
          if (insideSquareBrackets) currentChar = char // Don't escape '-' inside square brackets
          break
      }
      regexString += currentChar
    } else {
      switch (char) {
        case '[':
          insideSquareBrackets = true
          break
        case ']':
          insideSquareBrackets = false
          break
      }
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

export function removeDirNavWildcards(filePath) {
  return path.normalize(filePath).replace(/(\.\.\/|\.\/|\/\.\.|\.\.\\|\.\\|\\\.\.)/g, '')
}

export function pathContainsPathSegment(filePath, segment) {
  segment = removeDirNavWildcards(segment)
  if (hasMagic(segment)) {
    segment = convertGlobToRegex(segment)
    if (!segment) return false
    return segment.test(filePath)
  } else {
    return filePath.includes(segment)
  }
}

export function doesFileBelongToPath(filePath, configPaths) {
  if (!configPaths) return false
  if (!Array.isArray(configPaths)) configPaths = [configPaths]
  for (const configPath of configPaths) {
    if (!configPath.in) continue
    const configInPaths = Array.isArray(configPath.in) ? configPath.in : [configPath.in]
    for (const inPath of configInPaths) {
      if (pathContainsPathSegment(filePath, inPath)) {
        return {
          in: inPath,
          out: configPath.out || null
        }
      }
    }
  }
  return false
}
