import { it, describe, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { extractKeywords, generateSearchIndex, generateSitemap, generateIndexFiles } from '../indexer.js'

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexer-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function relativeTmpDir() {
  return path.relative(process.cwd(), tmpDir)
}

describe('extractKeywords', () => {
  const stopWords = new Set(['the', 'is', 'a', 'an', 'and', 'to', 'of', 'in', 'for'])

  it('extracts words from plain text', () => {
    const result = extractKeywords('<p>JavaScript bundler for modern apps</p>', { stopWords })
    expect(result).toContain('javascript')
    expect(result).toContain('bundler')
    expect(result).toContain('modern')
    expect(result).toContain('apps')
  })

  it('strips HTML tags before extracting', () => {
    const result = extractKeywords('<h1>Title</h1><p>Content <strong>bold</strong></p>', { stopWords })
    expect(result).toContain('title')
    expect(result).toContain('content')
    expect(result).toContain('bold')
    expect(result).not.toContain('h1')
    expect(result).not.toContain('strong')
  })

  it('filters out stop words', () => {
    const result = extractKeywords('<p>the quick fox is a fast animal</p>', { stopWords })
    expect(result).not.toContain('the')
    expect(result).not.toContain('is')
    expect(result).not.toContain('a')
    expect(result).toContain('quick')
    expect(result).toContain('fox')
  })

  it('filters out words shorter than minWordLength', () => {
    const result = extractKeywords('<p>go to me fox dog cat</p>', { stopWords, minWordLength: 4 })
    expect(result).not.toContain('fox')
    expect(result).not.toContain('dog')
    expect(result).not.toContain('cat')
  })

  it('defaults minWordLength to 3', () => {
    const result = extractKeywords('<p>go ox fox dog</p>', { stopWords })
    expect(result).toContain('fox')
    expect(result).toContain('dog')
    expect(result).not.toContain('go')
    expect(result).not.toContain('ox')
  })

  it('filters out pure numbers', () => {
    const result = extractKeywords('<p>version 123 release 456</p>', { stopWords })
    expect(result).not.toContain('123')
    expect(result).not.toContain('456')
    expect(result).toContain('version')
    expect(result).toContain('release')
  })

  it('sorts by frequency descending', () => {
    const result = extractKeywords(
      '<p>react react react vue vue angular</p>',
      { stopWords }
    )
    expect(result[0]).toBe('react')
    expect(result[1]).toBe('vue')
    expect(result[2]).toBe('angular')
  })

  it('returns empty array for empty content', () => {
    expect(extractKeywords('', { stopWords })).toEqual([])
  })

  it('returns empty array when all words are stop words', () => {
    const result = extractKeywords('<p>the is a an</p>', { stopWords })
    expect(result).toEqual([])
  })

  it('handles content with no stop words set', () => {
    const result = extractKeywords('<p>hello world</p>', { stopWords: new Set() })
    expect(result).toContain('hello')
    expect(result).toContain('world')
  })

  it('preserves hyphenated words', () => {
    const result = extractKeywords('<p>server-side rendering</p>', { stopWords })
    expect(result).toContain('server-side')
  })

  it('strips punctuation but keeps words', () => {
    const result = extractKeywords('<p>Hello, world! Great stuff.</p>', { stopWords })
    expect(result).toContain('hello')
    expect(result).toContain('world')
    expect(result).toContain('great')
    expect(result).toContain('stuff')
  })

  it('works without stopWords option', () => {
    const result = extractKeywords('<p>hello world test</p>')
    expect(result).toContain('hello')
    expect(result).toContain('world')
    expect(result).toContain('test')
  })
})

describe('generateSearchIndex', () => {
  const pageEntries = [
    {
      url: 'blog/post.html',
      title: 'My Post',
      excerpt: 'A great post',
      date: '2024-01-15',
      collection: 'blog',
      content: '<p>JavaScript bundler bundler bundler for modern apps</p>',
      isIndex: false
    },
    {
      url: 'about.html',
      title: 'About',
      excerpt: 'About page',
      date: null,
      collection: null,
      content: '<p>This page describes the project</p>',
      isIndex: false
    },
    {
      url: 'blog',
      title: 'Blog',
      excerpt: '',
      date: null,
      content: '',
      isIndex: true
    }
  ]

  it('writes a JSON file to the output directory', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), 'search-index.json')
    const outputPath = path.join(tmpDir, 'search-index.json')
    expect(fs.existsSync(outputPath)).toBe(true)
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
    expect(Array.isArray(data)).toBe(true)
  })

  it('excludes isIndex pages from the search index', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), 'search-index.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    expect(data.length).toBe(2)
    expect(data.find(e => e.title === 'Blog')).toBeUndefined()
  })

  it('includes title, url, and keywords for each entry', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), 'search-index.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    const post = data.find(e => e.title === 'My Post')
    expect(post).toBeDefined()
    expect(post.url).toBe('blog/post.html')
    expect(post.excerpt).toBe('A great post')
    expect(Array.isArray(post.keywords)).toBe(true)
    expect(post.keywords.length).toBeGreaterThan(0)
  })

  it('includes collection field when present', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), 'search-index.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    const post = data.find(e => e.title === 'My Post')
    expect(post.collection).toBe('blog')
  })

  it('passes through extra frontmatter fields', () => {
    const entries = [{
      url: 'post.html',
      title: 'Tagged Post',
      excerpt: 'A post with tags',
      tags: ['javascript', 'testing'],
      author: 'John',
      lang: 'en',
      content: '<p>hello world</p>',
      isIndex: false
    }]
    generateSearchIndex(entries, relativeTmpDir(), 'search-index.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    expect(data[0].tags).toEqual(['javascript', 'testing'])
    expect(data[0].author).toBe('John')
    expect(data[0].lang).toBe('en')
  })

  it('prefers frontmatter keywords over extracted ones', () => {
    const entries = [{
      url: 'post.html',
      title: 'Custom Keywords',
      keywords: ['custom', 'user-defined'],
      content: '<p>some generated content here</p>',
      isIndex: false
    }]
    generateSearchIndex(entries, relativeTmpDir(), 'search-index.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    expect(data[0].keywords).toEqual(['custom', 'user-defined'])
  })

  it('preserves empty keywords array from frontmatter', () => {
    const entries = [{
      url: 'post.html',
      title: 'No Keywords',
      keywords: [],
      content: '<p>some content here</p>',
      isIndex: false
    }]
    generateSearchIndex(entries, relativeTmpDir(), 'search-index.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    expect(data[0].keywords).toEqual([])
  })

  it('uses default stop words when stopWords config is omitted', () => {
    const entries = [{
      url: 'test.html',
      title: 'Test',
      content: '<p>the javascript bundler for modern applications</p>',
      isIndex: false
    }]
    generateSearchIndex(entries, relativeTmpDir(), { output: 'search-index.json' })
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    expect(data[0].keywords).toContain('javascript')
    expect(data[0].keywords).not.toContain('the')
    expect(data[0].keywords).not.toContain('for')
  })

  it('strips internal fields from output', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), 'search-index.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    for (const entry of data) {
      expect(entry.content).toBeUndefined()
      expect(entry.isIndex).toBeUndefined()
      expect(entry.layout).toBeUndefined()
      expect(entry.published).toBeUndefined()
    }
  })

  it('respects maxKeywords config', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), {
      output: 'search-index.json',
      maxKeywords: 2
    })
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    for (const entry of data) {
      expect(entry.keywords.length).toBeLessThanOrEqual(2)
    }
  })

  it('applies global frequency ceiling', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      url: `page-${i}.html`,
      title: `Page ${i}`,
      excerpt: '',
      date: null,
      content: `<p>common word plus unique-${i}</p>`,
      isIndex: false
    }))

    generateSearchIndex(entries, relativeTmpDir(), {
      output: 'search-index.json',
      globalFrequencyCeiling: 0.5
    })
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))

    // "common", "word", "plus" appear in all 5 pages (100%), ceiling is 50% — should be dropped
    for (const entry of data) {
      expect(entry.keywords).not.toContain('common')
      expect(entry.keywords).not.toContain('word')
      expect(entry.keywords).not.toContain('plus')
    }
  })

  it('does nothing when config is null', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), null)
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })

  it('accepts string config as shorthand for output filename', () => {
    generateSearchIndex(pageEntries, relativeTmpDir(), 'index.json')
    expect(fs.existsSync(path.join(tmpDir, 'index.json'))).toBe(true)
  })

  it('supports custom stop words as array', () => {
    const entries = [{
      url: 'test.html',
      title: 'Test',
      excerpt: '',
      date: null,
      content: '<p>alpha beta gamma delta</p>',
      isIndex: false
    }]
    generateSearchIndex(entries, relativeTmpDir(), {
      output: 'search-index.json',
      stopWords: ['alpha', 'beta']
    })
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    expect(data[0].keywords).not.toContain('alpha')
    expect(data[0].keywords).not.toContain('beta')
    expect(data[0].keywords).toContain('gamma')
    expect(data[0].keywords).toContain('delta')
  })

  it('supports disabling stop words with false', () => {
    const entries = [{
      url: 'test.html',
      title: 'Test',
      excerpt: '',
      date: null,
      content: '<p>the fox and the dog</p>',
      isIndex: false
    }]
    generateSearchIndex(entries, relativeTmpDir(), {
      output: 'search-index.json',
      stopWords: false
    })
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
    expect(data[0].keywords).toContain('the')
    expect(data[0].keywords).toContain('and')
    expect(data[0].keywords).toContain('fox')
  })
})

describe('generateSitemap', () => {
  const pageEntries = [
    { url: 'blog/post.html', title: 'Post', date: '2024-01-15', isIndex: false },
    { url: 'about.html', title: 'About', date: null, isIndex: false },
    { url: 'blog', title: 'Blog', date: null, isIndex: true }
  ]

  it('writes a valid XML file', () => {
    generateSitemap(pageEntries, relativeTmpDir(), 'https://example.com', 'sitemap.xml')
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('</urlset>')
  })

  it('includes all pages (both index and non-index)', () => {
    generateSitemap(pageEntries, relativeTmpDir(), 'https://example.com', 'sitemap.xml')
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).toContain('https://example.com/blog/post.html')
    expect(xml).toContain('https://example.com/about.html')
    expect(xml).toContain('https://example.com/blog')
  })

  it('includes lastmod when date is present', () => {
    generateSitemap(pageEntries, relativeTmpDir(), 'https://example.com', 'sitemap.xml')
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).toContain('<lastmod>2024-01-15</lastmod>')
  })

  it('omits lastmod when date is null', () => {
    generateSitemap(
      [{ url: 'page.html', title: 'Page', date: null }],
      relativeTmpDir(), 'https://example.com', 'sitemap.xml'
    )
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).not.toContain('<lastmod>')
  })

  it('prepends site URL to all locations', () => {
    generateSitemap(
      [{ url: 'page.html', title: 'Page', date: null }],
      relativeTmpDir(), 'https://mysite.com/', 'sitemap.xml'
    )
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://mysite.com/page.html</loc>')
    // trailing slash on site URL should be stripped
    expect(xml).not.toContain('https://mysite.com//page.html')
  })

  it('uses relative URLs when no site URL is provided', () => {
    generateSitemap(
      [{ url: 'page.html', title: 'Page', date: null }],
      relativeTmpDir(), '', 'sitemap.xml'
    )
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>page.html</loc>')
  })

  it('escapes special XML characters in URLs', () => {
    generateSitemap(
      [{ url: 'page.html?foo=1&bar=2', title: 'Page', date: null }],
      relativeTmpDir(), 'https://example.com', 'sitemap.xml'
    )
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).toContain('&amp;')
    expect(xml).not.toContain('&bar')
  })

  it('does nothing when config is null', () => {
    generateSitemap(pageEntries, relativeTmpDir(), 'https://example.com', null)
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })
})

describe('generateIndexFiles', () => {
  const pageEntries = [
    {
      url: 'page.html',
      title: 'Page',
      excerpt: 'Desc',
      date: '2024-01-01',
      content: '<p>some content here</p>',
      isIndex: false
    }
  ]

  it('generates both search index and sitemap', () => {
    generateIndexFiles(pageEntries, relativeTmpDir(), 'https://example.com', {
      searchIndex: 'search.json',
      sitemap: 'sitemap.xml'
    })
    expect(fs.existsSync(path.join(tmpDir, 'search.json'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'sitemap.xml'))).toBe(true)
  })

  it('generates only search index when sitemap config is falsy', () => {
    generateIndexFiles(pageEntries, relativeTmpDir(), 'https://example.com', {
      searchIndex: 'search.json',
      sitemap: null
    })
    expect(fs.existsSync(path.join(tmpDir, 'search.json'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'sitemap.xml'))).toBe(false)
  })

  it('generates only sitemap when search index config is falsy', () => {
    generateIndexFiles(pageEntries, relativeTmpDir(), 'https://example.com', {
      searchIndex: null,
      sitemap: 'sitemap.xml'
    })
    expect(fs.existsSync(path.join(tmpDir, 'search.json'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, 'sitemap.xml'))).toBe(true)
  })
})
