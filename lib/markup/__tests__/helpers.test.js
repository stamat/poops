import { it, describe, expect } from '@jest/globals'
import path from 'node:path'
import {
  replaceOutExtensions,
  getUpDirPrefix,
  getRelativePathPrefix,
  getPageUrl,
  getPageUrlRelativeToOutput
} from '../helpers.js'

describe('replaceOutExtensions', () => {
  it('replaces .md with .html', () => {
    expect(replaceOutExtensions('posts/hello.md')).toBe('posts/hello.html')
  })

  it('replaces .njk with .html', () => {
    expect(replaceOutExtensions('index.njk')).toBe('index.html')
  })

  it('leaves .html unchanged', () => {
    expect(replaceOutExtensions('page.html')).toBe('page.html')
  })

  it('leaves other extensions unchanged', () => {
    expect(replaceOutExtensions('feed.xml')).toBe('feed.xml')
    expect(replaceOutExtensions('data.json')).toBe('data.json')
  })
})

describe('getUpDirPrefix', () => {
  it('returns empty string for empty input', () => {
    expect(getUpDirPrefix('')).toBe('')
    expect(getUpDirPrefix('  ')).toBe('')
  })

  it('returns ../ for single directory depth', () => {
    expect(getUpDirPrefix('dist')).toBe('../')
  })

  it('returns ../../ for two-level depth', () => {
    expect(getUpDirPrefix('dist/pages')).toBe('../../')
  })

  it('strips leading slash', () => {
    expect(getUpDirPrefix('/dist')).toBe('../')
  })

  it('strips trailing slash', () => {
    expect(getUpDirPrefix('dist/')).toBe('../')
  })

  it('uses forward slashes (URL-safe)', () => {
    const result = getUpDirPrefix('a/b/c')
    expect(result).toBe('../../../')
    expect(result).not.toContain('\\')
  })
})

describe('getRelativePathPrefix', () => {
  it('returns empty string when outputDir is cwd', () => {
    expect(getRelativePathPrefix(process.cwd())).toBe('')
  })

  it('returns ../ for one level deep', () => {
    const outputDir = path.join(process.cwd(), 'dist')
    expect(getRelativePathPrefix(outputDir)).toBe('../')
  })

  it('strips fromDir prefix from the relative path', () => {
    const outputDir = path.join(process.cwd(), 'dist', 'pages')
    const fromDir = path.join(process.cwd(), 'dist')
    expect(getRelativePathPrefix(outputDir, fromDir)).toBe('../')
  })
})

describe('getPageUrl', () => {
  it('returns directory for index files', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'about', 'index.html')
    expect(getPageUrl(outputPath)).toBe(path.join('dist', 'about'))
  })

  it('returns file path for non-index files', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'page.html')
    expect(getPageUrl(outputPath)).toBe(path.join('dist', 'page.html'))
  })

  it('replaces .njk extension before checking', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'index.njk')
    expect(getPageUrl(outputPath)).toBe('dist')
  })

  it('replaces .md extension before checking', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'post.md')
    expect(getPageUrl(outputPath)).toBe(path.join('dist', 'post.html'))
  })
})

describe('getPageUrlRelativeToOutput', () => {
  it('returns URL relative to the output directory', () => {
    const outputPath = path.join(process.cwd(), 'example', 'dist', 'blog', 'post.html')
    expect(getPageUrlRelativeToOutput(outputPath, 'example/dist')).toBe(path.join('blog', 'post.html'))
  })

  it('returns empty string for index at output root', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'index.html')
    expect(getPageUrlRelativeToOutput(outputPath, 'dist')).toBe('')
  })

  it('handles nested paths', () => {
    const outputPath = path.join(process.cwd(), 'out', 'docs', 'api', 'page.njk')
    expect(getPageUrlRelativeToOutput(outputPath, 'out')).toBe(path.join('docs', 'api', 'page.html'))
  })
})
