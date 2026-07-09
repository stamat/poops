import { it, describe, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { extractKeywords, generateSearchIndex, generateSitemap, generateIndexFiles, buildNavTree, generateNav } from '../indexer.js'

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

  it('generates a nav file when nav config is set', () => {
    generateIndexFiles(pageEntries, relativeTmpDir(), 'https://example.com', {
      nav: 'nav.json'
    })
    expect(fs.existsSync(path.join(tmpDir, 'nav.json'))).toBe(true)
  })
})

describe('buildNavTree', () => {
  it('nests subpages by url segments', () => {
    const tree = buildNavTree([
      { url: 'guide', title: 'Guide', order: 1, isIndex: false },
      { url: 'guide/getting-started', title: 'Getting Started', order: 1, isIndex: false },
      { url: 'about', title: 'About', order: 2, isIndex: false }
    ])

    expect(tree.map(n => n.title)).toEqual(['Guide', 'About'])
    const guide = tree[0]
    expect(guide.url).toBe('guide')
    expect(guide.children.map(n => n.title)).toEqual(['Getting Started'])
    expect(guide.children[0].url).toBe('guide/getting-started')
  })

  it('sorts siblings by order, then alphabetically by title', () => {
    const tree = buildNavTree([
      { url: 'zebra', title: 'Zebra', order: 1, isIndex: false },
      { url: 'apple', title: 'Apple', order: 1, isIndex: false },
      { url: 'first', title: 'First', order: 0, isIndex: false },
      { url: 'unordered', title: 'Unordered', isIndex: false }
    ])
    // order 0, then order 1 (Apple before Zebra alphabetically), then no order
    expect(tree.map(n => n.title)).toEqual(['First', 'Apple', 'Zebra', 'Unordered'])
  })

  it('excludes pages with nav: false', () => {
    const tree = buildNavTree([
      { url: 'shown', title: 'Shown', isIndex: false },
      { url: 'hidden', title: 'Hidden', nav: false, isIndex: false }
    ])
    expect(tree.map(n => n.title)).toEqual(['Shown'])
  })

  it('excludes isIndex collection/pagination pages by default', () => {
    const tree = buildNavTree([
      { url: 'page', title: 'Page', isIndex: false },
      { url: 'blog', title: 'blog', isIndex: true },
      { url: 'blog/2', title: 'blog', isIndex: true }
    ])
    expect(tree.map(n => n.title)).toEqual(['Page'])
  })

  it('synthesizes a virtual node for an index-less section, humanizing the segment', () => {
    const tree = buildNavTree([
      { url: 'api-reference/config', title: 'Config', isIndex: false }
    ])
    expect(tree.length).toBe(1)
    expect(tree[0].title).toBe('Api Reference')
    expect(tree[0].url).toBeUndefined()
    expect(tree[0].children.map(n => n.title)).toEqual(['Config'])
  })

  it('lets a virtual parent borrow its first child order', () => {
    const tree = buildNavTree([
      { url: 'later', title: 'Later', order: 9, isIndex: false },
      { url: 'section/child', title: 'Child', order: 2, isIndex: false }
    ])
    // Section (virtual, order borrowed = 2) sorts before Later (order 9)
    expect(tree.map(n => n.title)).toEqual(['Section', 'Later'])
    expect(tree[0].order).toBe(2)
  })

  it('emits the root index page (url "") as a top-level node', () => {
    const tree = buildNavTree([
      { url: '', title: 'Home', order: 0, isIndex: false },
      { url: 'about', title: 'About', order: 1, isIndex: false }
    ])
    expect(tree.map(n => n.title)).toEqual(['Home', 'About'])
    expect(tree[0].url).toBe('')
  })

  it('drops the root index node with home: false', () => {
    const tree = buildNavTree([
      { url: '', title: 'Home', isIndex: false },
      { url: 'about', title: 'About', isIndex: false }
    ], { home: false })
    expect(tree.map(n => n.title)).toEqual(['About'])
  })

  it('drops all collection member pages with collections: false', () => {
    const tree = buildNavTree([
      { url: 'about', title: 'About', isIndex: false },
      { url: 'blog/post', title: 'Post', collection: 'blog', isIndex: false }
    ], { collections: false })
    expect(tree.map(n => n.title)).toEqual(['About'])
  })

  it('keeps only allowlisted collections when collections is an array', () => {
    const tree = buildNavTree([
      { url: 'docs/intro', title: 'Intro', collection: 'docs', isIndex: false },
      { url: 'blog/post', title: 'Post', collection: 'blog', isIndex: false }
    ], { collections: ['docs'] })
    expect(tree.map(n => n.title)).toEqual(['Docs'])
    expect(tree[0].children.map(n => n.title)).toEqual(['Intro'])
  })

  it('collections: "index" keeps the landing leaf and drops members + pagination', () => {
    // landing entries carry the raw collection name as title (see markups.js)
    const tree = buildNavTree([
      { url: 'blog', title: 'blog', isIndex: true },
      { url: 'blog/2', title: 'blog', isIndex: true },
      { url: 'release-notes', title: 'release-notes', isIndex: true },
      { url: 'blog/post', title: 'Post', collection: 'blog', isIndex: false }
    ], { collections: 'index' })
    // raw collection names are humanized for display
    expect(tree.map(n => n.title)).toEqual(['Blog', 'Release Notes'])
    expect(tree[0].url).toBe('blog')
    expect(tree[0].children).toBeUndefined()
  })

  it('prefers navTitle over title for the sidebar label', () => {
    const tree = buildNavTree([
      { url: 'about', title: 'About Our Great Company', navTitle: 'About', isIndex: false }
    ])
    expect(tree.map(n => n.title)).toEqual(['About'])
  })

  it('scopes to a subtree with root, unwrapping and pinning the section index first', () => {
    const tree = buildNavTree([
      { url: 'index', title: 'Home', isIndex: false },
      { url: 'docs', title: 'Docs Overview', order: 5, isIndex: false },
      { url: 'docs/getting-started', title: 'Getting Started', order: 2, isIndex: false },
      { url: 'docs/advanced', title: 'Advanced', order: 1, isIndex: false }
    ], { root: 'docs' })

    // overview pinned first, then children sorted by order — homepage excluded
    expect(tree.map(n => n.title)).toEqual(['Docs Overview', 'Advanced', 'Getting Started'])
    // urls stay full, not stripped of the root prefix
    expect(tree[0].url).toBe('docs')
    expect(tree[1].url).toBe('docs/advanced')
  })

  it('returns [] when nothing survives filtering', () => {
    const tree = buildNavTree([
      { url: 'blog/post', title: 'Post', collection: 'blog', isIndex: false }
    ], { collections: false })
    expect(tree).toEqual([])
  })
})

describe('generateNav', () => {
  const pageEntries = [
    { url: 'guide', title: 'Guide', order: 1, isIndex: false },
    { url: 'guide/intro', title: 'Intro', order: 1, isIndex: false }
  ]

  it('writes a nested JSON tree to the output directory', () => {
    generateNav(pageEntries, relativeTmpDir(), 'nav.json')
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'nav.json'), 'utf-8'))
    expect(data[0].title).toBe('Guide')
    expect(data[0].children[0].title).toBe('Intro')
  })

  it('writes [] when the tree is empty', () => {
    generateNav([], relativeTmpDir(), 'nav.json')
    expect(JSON.parse(fs.readFileSync(path.join(tmpDir, 'nav.json'), 'utf-8'))).toEqual([])
  })

  it('does nothing when config is null', () => {
    generateNav(pageEntries, relativeTmpDir(), null)
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })
})
