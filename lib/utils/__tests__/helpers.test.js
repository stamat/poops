import { afterEach, it, describe, expect } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
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
  parseFrontMatter,
  clearFrontMatterCache,
  deleteDirectory,
  deleteDirectoryContents,
  copyDirectory,
  convertGlobToRegex,
  removeDirNavWildcards,
  pathContainsPathSegment,
  doesFileBelongToPath
} from '../helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(__dirname, 'fixtures', 'helpers')
const TMP = path.join(__dirname, 'fixtures', 'helpers', '_tmp')

afterEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true })
  clearFrontMatterCache()
})

// --- Path utilities ---

describe('pathExists', () => {
  it('returns true for existing file', () => {
    expect(pathExists(path.join(FIXTURES, 'data', 'sample.json'))).toBe(true)
  })

  it('returns true for existing directory', () => {
    expect(pathExists(path.join(FIXTURES, 'data'))).toBe(true)
  })

  it('returns false for nonexistent path', () => {
    expect(pathExists(path.join(FIXTURES, 'nope'))).toBe(false)
  })

  it('joins multiple arguments', () => {
    expect(pathExists(FIXTURES, 'data', 'sample.json')).toBe(true)
  })
})

describe('pathIsDirectory', () => {
  it('returns true for a directory', () => {
    expect(pathIsDirectory(path.join(FIXTURES, 'data'))).toBe(true)
  })

  it('returns false for a file', () => {
    expect(pathIsDirectory(path.join(FIXTURES, 'data', 'sample.json'))).toBe(false)
  })

  it('joins multiple arguments', () => {
    expect(pathIsDirectory(FIXTURES, 'data')).toBe(true)
  })
})

describe('pathForFile', () => {
  it('returns true for paths with extensions', () => {
    expect(pathForFile('styles.css')).toBe(true)
    expect(pathForFile('src/main.js')).toBe(true)
  })

  it('returns false for paths without extensions', () => {
    expect(pathForFile('dist')).toBe(false)
    expect(pathForFile('src/output')).toBe(false)
  })

  it('returns false for dotfiles', () => {
    expect(pathForFile('.gitignore')).toBe(false)
    expect(pathForFile('src/.env')).toBe(false)
  })
})

// --- Directory operations ---

describe('mkDir', () => {
  it('creates a directory recursively', () => {
    const dir = path.join(TMP, 'a', 'b', 'c')
    mkDir(dir)
    expect(fs.existsSync(dir)).toBe(true)
  })

  it('does nothing if directory already exists', () => {
    const dir = path.join(TMP, 'existing')
    mkDir(dir)
    mkDir(dir)
    expect(fs.existsSync(dir)).toBe(true)
  })
})

describe('mkPath', () => {
  it('creates parent directories for a file path', () => {
    const filePath = path.join(TMP, 'deep', 'dir', 'file.txt')
    mkPath(filePath)
    expect(fs.existsSync(path.join(TMP, 'deep', 'dir'))).toBe(true)
    expect(fs.existsSync(filePath)).toBe(false)
  })
})

describe('deleteDirectory', () => {
  it('removes a directory recursively', () => {
    const dir = path.join(TMP, 'to-delete')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'file.txt'), 'hi')
    deleteDirectory(dir)
    expect(fs.existsSync(dir)).toBe(false)
  })

  it('does nothing for nonexistent directory', () => {
    deleteDirectory(path.join(TMP, 'nonexistent'))
  })
})

describe('deleteDirectoryContents', () => {
  it('removes contents but keeps the directory', () => {
    const dir = path.join(TMP, 'clear-me')
    const sub = path.join(dir, 'sub')
    fs.mkdirSync(sub, { recursive: true })
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a')
    fs.writeFileSync(path.join(sub, 'b.txt'), 'b')
    deleteDirectoryContents(dir)
    expect(fs.existsSync(dir)).toBe(true)
    expect(fs.readdirSync(dir)).toHaveLength(0)
  })

  it('does nothing for nonexistent directory', () => {
    deleteDirectoryContents(path.join(TMP, 'nonexistent'))
  })
})

describe('copyDirectory', () => {
  it('copies a directory recursively', () => {
    const dest = path.join(TMP, 'copy-dest')
    copyDirectory(path.join(FIXTURES, 'copy-src'), dest)
    expect(fs.readFileSync(path.join(dest, 'file.txt'), 'utf8')).toBe('root file')
    expect(fs.readFileSync(path.join(dest, 'nested', 'deep.txt'), 'utf8')).toBe('nested file')
  })

  it('copies a single file when src is a file', () => {
    fs.mkdirSync(TMP, { recursive: true })
    const dest = path.join(TMP, 'copied.txt')
    copyDirectory(path.join(FIXTURES, 'copy-src', 'file.txt'), dest)
    expect(fs.readFileSync(dest, 'utf8')).toBe('root file')
  })

  it('does nothing for nonexistent source', () => {
    copyDirectory(path.join(FIXTURES, 'nonexistent'), path.join(TMP, 'nope'))
    expect(fs.existsSync(path.join(TMP, 'nope'))).toBe(false)
  })
})

// --- Output path builders ---

describe('insertMinSuffix', () => {
  it('inserts .min before the extension', () => {
    expect(insertMinSuffix('dist/styles.css')).toBe(path.join('dist', 'styles.min.css'))
  })

  it('handles nested paths', () => {
    expect(insertMinSuffix('a/b/c/app.js')).toBe(path.join('a', 'b', 'c', 'app.min.js'))
  })
})

describe('buildStyleOutputFilePath', () => {
  it('returns outputPath as-is when it looks like a file', () => {
    expect(buildStyleOutputFilePath('src/main.scss', 'dist/bundle.css')).toBe('dist/bundle.css')
  })

  it('appends input name with .css when output is a directory', () => {
    expect(buildStyleOutputFilePath('src/main.scss', 'dist')).toBe(path.join('dist', 'main.css'))
  })
})

describe('buildScriptOutputFilePath', () => {
  it('returns outputPath as-is when it looks like a file', () => {
    expect(buildScriptOutputFilePath('src/app.ts', 'dist/bundle.js')).toBe('dist/bundle.js')
  })

  it('converts .ts to .js when output is a directory', () => {
    expect(buildScriptOutputFilePath('src/app.ts', 'dist')).toBe(path.join('dist', 'app.js'))
  })

  it('keeps .js as .js', () => {
    expect(buildScriptOutputFilePath('src/app.js', 'dist')).toBe(path.join('dist', 'app.js'))
  })
})

// --- Formatting ---

describe('buildTime', () => {
  it('formats sub-second times in milliseconds', () => {
    expect(buildTime(0, 150)).toBe('150ms')
  })

  it('formats zero duration', () => {
    expect(buildTime(100, 100)).toBe('0ms')
  })

  it('formats seconds with remainder', () => {
    expect(buildTime(0, 3500)).toBe('3s 500ms')
  })

  it('formats exact seconds', () => {
    expect(buildTime(0, 2000)).toBe('2s 0ms')
  })

  it('formats minutes with remainder', () => {
    expect(buildTime(0, 125000)).toBe('2m 5s 0ms')
  })

  it('formats minutes with all components', () => {
    expect(buildTime(0, 125750)).toBe('2m 5s 750ms')
  })
})

describe('fileSize', () => {
  it('formats small files in bytes', () => {
    const filePath = path.join(TMP, 'small.txt')
    fs.mkdirSync(TMP, { recursive: true })
    fs.writeFileSync(filePath, 'hi')
    expect(fileSize(filePath)).toBe('2B')
  })

  it('formats kilobyte files', () => {
    const filePath = path.join(TMP, 'medium.txt')
    fs.mkdirSync(TMP, { recursive: true })
    fs.writeFileSync(filePath, 'x'.repeat(5000))
    expect(fileSize(filePath)).toBe('5KB')
  })

  it('formats megabyte files with KB remainder', () => {
    const filePath = path.join(TMP, 'large.txt')
    fs.mkdirSync(TMP, { recursive: true })
    fs.writeFileSync(filePath, 'x'.repeat(1_500_000))
    expect(fileSize(filePath)).toBe('1MB 500KB')
  })

  it('formats megabyte files with no remainder', () => {
    const filePath = path.join(TMP, 'exact-mb.txt')
    fs.mkdirSync(TMP, { recursive: true })
    fs.writeFileSync(filePath, 'x'.repeat(2_000_000))
    expect(fileSize(filePath)).toBe('2MB 0KB')
  })
})

// --- Banner template ---

describe('fillBannerTemplate', () => {
  it('replaces all template variables from package.json', () => {
    const template = '/* {{name}} v{{version}} | {{license}} | {{author}} | {{homepage}} | {{description}} */'
    const result = fillBannerTemplate(template, FIXTURES)
    expect(result).toBe('/* test-pkg v1.2.3 | MIT | Test Author | https://example.com | A test package */')
  })

  it('replaces {{year}} with current year', () => {
    const result = fillBannerTemplate('(c) {{ year }}', FIXTURES)
    expect(result).toBe(`(c) ${new Date().getFullYear()}`)
  })

  it('returns template unchanged when package.json is missing', () => {
    const template = '/* {{name}} */'
    expect(fillBannerTemplate(template, '/nonexistent/path')).toBe(template)
  })
})

// --- Data file reading ---

describe('readJsonFile', () => {
  it('parses a JSON file', () => {
    const result = readJsonFile(path.join(FIXTURES, 'data', 'sample.json'))
    expect(result).toEqual({ key: 'value', number: 42 })
  })
})

describe('readYamlFile', () => {
  it('parses a YAML file', () => {
    const result = readYamlFile(path.join(FIXTURES, 'data', 'sample.yaml'))
    expect(result).toEqual({ title: 'Hello', items: ['one', 'two'] })
  })

  it('returns null for malformed YAML', () => {
    const result = readYamlFile(path.join(FIXTURES, 'data', 'bad.yaml'))
    expect(result).toBeNull()
  })
})

describe('readDataFile', () => {
  it('reads JSON by extension', () => {
    const result = readDataFile(path.join(FIXTURES, 'data', 'sample.json'))
    expect(result).toEqual({ key: 'value', number: 42 })
  })

  it('reads YAML by extension', () => {
    const result = readDataFile(path.join(FIXTURES, 'data', 'sample.yaml'))
    expect(result).toEqual({ title: 'Hello', items: ['one', 'two'] })
  })

  it('reads plain text for unknown extensions', () => {
    const result = readDataFile(path.join(FIXTURES, 'data', 'sample.txt'))
    expect(result).toBe('plain text content')
  })
})

// --- Front matter ---

describe('parseFrontMatter', () => {
  it('extracts front matter and content', () => {
    const result = parseFrontMatter(path.join(FIXTURES, 'front-matter', 'with-fm.md'))
    expect(result.frontMatter.title).toBe('Test Post')
    expect(result.frontMatter.date).toBe('2024-01-15')
    expect(result.frontMatter.tags).toEqual(['javascript', 'testing'])
    expect(result.content).toContain('# Hello World')
    expect(result.content).not.toContain('---')
  })

  it('returns empty front matter when none present', () => {
    const result = parseFrontMatter(path.join(FIXTURES, 'front-matter', 'without-fm.md'))
    expect(result.frontMatter).toEqual({})
    expect(result.content).toContain('# No Front Matter')
  })

  it('throws for nonexistent file', () => {
    expect(() => parseFrontMatter('/nonexistent/file.md')).toThrow('Error stating file')
  })

  it('caches results and returns a copy of frontMatter', () => {
    const filePath = path.join(FIXTURES, 'front-matter', 'with-fm.md')
    const first = parseFrontMatter(filePath)
    const second = parseFrontMatter(filePath)
    expect(second.frontMatter).toEqual(first.frontMatter)
    first.frontMatter.title = 'mutated'
    expect(second.frontMatter.title).toBe('Test Post')
  })
})

describe('clearFrontMatterCache', () => {
  it('clears cache for a specific file', () => {
    const filePath = path.join(FIXTURES, 'front-matter', 'with-fm.md')
    parseFrontMatter(filePath)
    clearFrontMatterCache(filePath)
    // no error — just verifying it doesn't throw
  })

  it('clears entire cache when called without arguments', () => {
    parseFrontMatter(path.join(FIXTURES, 'front-matter', 'with-fm.md'))
    parseFrontMatter(path.join(FIXTURES, 'front-matter', 'without-fm.md'))
    clearFrontMatterCache()
  })
})

// --- Glob / path matching ---

describe('convertGlobToRegex', () => {
  it('converts * to match non-separator characters', () => {
    const re = convertGlobToRegex('*.js')
    expect(re.test('app.js')).toBe(true)
    expect(re.test('app.ts')).toBe(false)
  })

  it('converts ? to match single character', () => {
    const re = convertGlobToRegex('?.js')
    expect(re.test('a.js')).toBe(true)
    expect(re.test('.js')).toBe(false)
  })

  it('converts brace expansion to alternation', () => {
    const re = convertGlobToRegex('*.{js,ts}')
    expect(re.test('app.js')).toBe(true)
    expect(re.test('app.ts')).toBe(true)
    expect(re.test('app.css')).toBe(false)
  })

  it('escapes dots', () => {
    const re = convertGlobToRegex('file.txt')
    expect(re.test('fileTtxt')).toBe(false)
    expect(re.test('file.txt')).toBe(true)
  })

  it('returns null for invalid regex', () => {
    const re = convertGlobToRegex('[invalid')
    expect(re).toBeNull()
  })
})

describe('removeDirNavWildcards', () => {
  it('removes ../ segments', () => {
    expect(removeDirNavWildcards('../src/file.js')).toBe('src/file.js')
  })

  it('removes ./ segments', () => {
    expect(removeDirNavWildcards('./src/file.js')).toBe('src/file.js')
  })
})

describe('pathContainsPathSegment', () => {
  it('matches literal path segments', () => {
    expect(pathContainsPathSegment('src/styles/main.css', 'src/styles')).toBe(true)
  })

  it('does not match unrelated paths', () => {
    expect(pathContainsPathSegment('dist/output.css', 'src/styles')).toBe(false)
  })

  it('matches glob patterns', () => {
    expect(pathContainsPathSegment('src/app.js', '*.js')).toBe(true)
  })
})

describe('doesFileBelongToPath', () => {
  it('returns matching config when file belongs', () => {
    const config = [{ in: 'src/styles', out: 'dist/css' }]
    const result = doesFileBelongToPath('src/styles/main.scss', config)
    expect(result).toEqual({ in: 'src/styles', out: 'dist/css' })
  })

  it('returns false when file does not belong', () => {
    const config = [{ in: 'src/styles', out: 'dist/css' }]
    expect(doesFileBelongToPath('lib/utils.js', config)).toBe(false)
  })

  it('returns false for null/undefined config', () => {
    expect(doesFileBelongToPath('file.js', null)).toBe(false)
    expect(doesFileBelongToPath('file.js', undefined)).toBe(false)
  })

  it('handles single config object (not array)', () => {
    const config = { in: 'src', out: 'dist' }
    expect(doesFileBelongToPath('src/app.js', config)).toEqual({ in: 'src', out: 'dist' })
  })

  it('handles array of input paths', () => {
    const config = [{ in: ['src/a', 'src/b'], out: 'dist' }]
    expect(doesFileBelongToPath('src/b/file.js', config)).toEqual({ in: 'src/b', out: 'dist' })
  })

  it('returns null out when out is missing', () => {
    const config = [{ in: 'src' }]
    const result = doesFileBelongToPath('src/file.js', config)
    expect(result).toEqual({ in: 'src', out: null })
  })
})
