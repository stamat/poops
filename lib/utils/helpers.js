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
  return path.extname(filePath) !== ''
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
  const seconds = Math.floor(time / 1000)
  const ms = time % 1000
  if (time < 60 * 1000) return `${seconds}s ${ms}ms`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s ${ms}ms`
}

export function fileSize(filePath) {
  const stats = fs.statSync(filePath)
  const fileSizeInBytes = stats.size
  if (fileSizeInBytes < 1000) return `${fileSizeInBytes}B`
  if (fileSizeInBytes < 1000 * 1000) return `${(fileSizeInBytes / 1000).toFixed(0)}KB`
  if (fileSizeInBytes < 1000 * 1000 * 1000) return `${Math.floor(fileSizeInBytes / 1000 / 1000)}MB ${Math.floor((fileSizeInBytes % (1000 * 1000)) / 1000)}KB`
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

function findMatchingParen(str, openIndex) {
  let depth = 1
  for (let i = openIndex + 1; i < str.length; i++) {
    if (str[i] === '(') depth++
    if (str[i] === ')') depth--
    if (depth === 0) return i
  }
  return -1
}

function extractNegatedGlobs(glob) {
  const negations = []
  for (let i = 0; i < glob.length; i++) {
    if (glob[i] === '!' && glob[i + 1] === '(') {
      const closeIndex = findMatchingParen(glob, i + 1)
      if (closeIndex !== -1) {
        negations.push({ start: i, end: closeIndex, inner: glob.slice(i + 2, closeIndex) })
        i = closeIndex
      }
    }
  }
  return negations
}

function buildGlobVariant(glob, negations, expandIndex) {
  let result = ''
  let lastEnd = 0
  negations.forEach((neg, idx) => {
    result += glob.slice(lastEnd, neg.start)
    result += idx === expandIndex ? '@(' + neg.inner + ')' : '*'
    lastEnd = neg.end + 1
  })
  result += glob.slice(lastEnd)
  return result
}

export function convertGlobToRegex(glob) {
  const negations = extractNegatedGlobs(glob)

  if (negations.length > 0) {
    const positiveGlob = buildGlobVariant(glob, negations, -1)
    const positiveRegex = convertGlobToRegex(positiveGlob)
    if (!positiveRegex) return null

    const negativeRegexes = negations.map((_, idx) => {
      return convertGlobToRegex(buildGlobVariant(glob, negations, idx))
    }).filter(Boolean)

    if (negativeRegexes.length === 0) return positiveRegex

    return {
      test(str) {
        const globalRe = new RegExp(positiveRegex.source, 'g')
        let match
        while ((match = globalRe.exec(str)) !== null) {
          if (negativeRegexes.every(re => !new RegExp('^' + re.source + '$').test(match[0]))) {
            return true
          }
          if (match[0].length === 0) globalRe.lastIndex++
        }
        return false
      }
    }
  }

  let regexString = ''
  let insideSquareBrackets = false
  let insideCurlyBraces = false
  const extglobStack = []

  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    const next = glob[i + 1]

    // Glob escape: \x → literal x
    if (char === '\\' && i + 1 < glob.length) {
      regexString += '\\' + next
      i++
      continue
    }

    // Inside character class [...]
    if (insideSquareBrackets) {
      if (char === ']') {
        insideSquareBrackets = false
        regexString += ']'
      } else if (char === '!') {
        regexString += '^'
      } else {
        regexString += char
      }
      continue
    }

    // Extended glob: ?(, *(, +(, @(
    if (next === '(' && '?*+@'.includes(char)) {
      extglobStack.push(char)
      regexString += '(?:'
      i++
      continue
    }

    // Closing ) for extglob
    if (char === ')' && extglobStack.length > 0) {
      const type = extglobStack.pop()
      const suffixes = { '?': ')?', '*': ')*', '+': ')+', '@': ')' }
      regexString += suffixes[type]
      continue
    }

    // ** globstar — matches across path separators
    if (char === '*' && next === '*') {
      regexString += '.*'
      i++
      if (glob[i + 1] === '/') i++
      continue
    }

    // * — matches within a single path segment
    if (char === '*') { regexString += '[^\\/\\\\]*'; continue }

    // ? — single non-separator character
    if (char === '?') { regexString += '[^\\/\\\\]'; continue }

    // Character class
    if (char === '[') { insideSquareBrackets = true; regexString += '['; continue }

    // Brace expansion
    if (char === '{') { insideCurlyBraces = true; regexString += '('; continue }
    if (char === '}') { insideCurlyBraces = false; regexString += ')'; continue }
    if (char === ',' && insideCurlyBraces) { regexString += '|'; continue }

    // Pipe is alternation inside extglob, literal outside
    if (char === '|' && extglobStack.length > 0) { regexString += '|'; continue }

    // Escape regex-special characters
    if ('.|+$^(){}\\/-'.includes(char)) { regexString += '\\' + char; continue }

    regexString += char
  }

  try {
    return new RegExp(regexString)
  } catch (e) {
    return null
  }
}

export function stripDirNavSegments(filePath) {
  return path.normalize(filePath).replace(/(\.\.\/|\.\/|\/\.\.|\.\.\\|\.\\|\\\.\.)/g, '')
}

export function pathContainsPathSegment(filePath, segment) {
  segment = stripDirNavSegments(segment)
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
