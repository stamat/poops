import { it, describe, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { extractKeywords, generateSearchIndex, generateSitemap, generateLlmsTxt, generateLlmsFull, generateRobotsTxt, generateIndexFiles, buildNavTree, generateNav, generateFeeds, _getKeywordCache } from '../indexer.js'

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

  describe('incremental keyword extraction (cross-compile memo)', () => {
    const config = { output: 'search-index.json', stopWords: false }

    function entry(url, content, extra = {}) {
      return { url, title: url, content, isIndex: false, ...extra }
    }

    it('reuses extracted keywords when content is unchanged (reference identity proves memo hit)', () => {
      const entries = [entry('a.html', '<p>alpha bravo</p>'), entry('b.html', '<p>charlie delta</p>')]

      generateSearchIndex(entries, relativeTmpDir(), config)
      const firstA = _getKeywordCache().get('a.html').keywords
      const firstB = _getKeywordCache().get('b.html').keywords

      generateSearchIndex(entries, relativeTmpDir(), config)
      // extractKeywords always builds a fresh array — same ref means no re-extraction
      expect(_getKeywordCache().get('a.html').keywords).toBe(firstA)
      expect(_getKeywordCache().get('b.html').keywords).toBe(firstB)
    })

    it('re-extracts only the page whose content changed', () => {
      const unchanged = entry('same.html', '<p>stable words</p>')
      generateSearchIndex([unchanged, entry('edited.html', '<p>original wording</p>')], relativeTmpDir(), config)
      const stableRef = _getKeywordCache().get('same.html').keywords

      generateSearchIndex([unchanged, entry('edited.html', '<p>rewritten paragraph</p>')], relativeTmpDir(), config)
      expect(_getKeywordCache().get('same.html').keywords).toBe(stableRef)

      const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
      const edited = data.find(e => e.url === 'edited.html')
      expect(edited.keywords).toContain('rewritten')
      expect(edited.keywords).not.toContain('original')
    })

    it('drops deleted pages from the cache', () => {
      generateSearchIndex([entry('kept.html', '<p>kept words</p>'), entry('gone.html', '<p>gone words</p>')], relativeTmpDir(), config)
      expect(_getKeywordCache().has('gone.html')).toBe(true)

      generateSearchIndex([entry('kept.html', '<p>kept words</p>')], relativeTmpDir(), config)
      expect(_getKeywordCache().has('gone.html')).toBe(false)
      expect(_getKeywordCache().has('kept.html')).toBe(true)
    })

    it('invalidates the whole cache when extraction config changes', () => {
      const entries = [entry('a.html', '<p>the alpha bravo</p>')]
      generateSearchIndex(entries, relativeTmpDir(), config)
      const before = _getKeywordCache().get('a.html').keywords
      expect(before).toContain('the')

      generateSearchIndex(entries, relativeTmpDir(), { ...config, stopWords: ['the'] })
      const after = _getKeywordCache().get('a.html').keywords
      expect(after).not.toBe(before)
      expect(after).not.toContain('the')
    })

    it('caches pre-ceiling keywords so the ceiling is recomputed per build', () => {
      // 2 pages share "common" (100% > 50% ceiling) — dropped from output
      const a = entry('a.html', '<p>common alpha</p>')
      const b = entry('b.html', '<p>common bravo</p>')
      const ceilingConfig = { ...config, globalFrequencyCeiling: 0.5 }

      generateSearchIndex([a, b], relativeTmpDir(), ceilingConfig)
      let data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
      expect(data.find(e => e.url === 'a.html').keywords).not.toContain('common')

      // third page without "common" lowers its frequency to 66%... still > 50%,
      // so add two: 2 of 4 pages = 50% = at ceiling, no longer dropped
      const c = entry('c.html', '<p>charlie unique</p>')
      const d = entry('d.html', '<p>delta unique</p>')
      generateSearchIndex([a, b, c, d], relativeTmpDir(), ceilingConfig)
      data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'search-index.json'), 'utf-8'))
      // would fail if the memo had cached the post-ceiling (filtered) array
      expect(data.find(e => e.url === 'a.html').keywords).toContain('common')
    })
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

  it('excludes pages with robots noindex/none, keeps nofollow-only', () => {
    generateSitemap(
      [
        { url: 'keep.html', title: 'Keep' },
        { url: 'hidden.html', title: 'Hidden', robots: 'noindex' },
        { url: 'gone.html', title: 'Gone', robots: 'noindex, nofollow' },
        { url: 'none.html', title: 'None', robots: 'none' },
        { url: 'followed.html', title: 'Followed', robots: 'nofollow' }
      ],
      relativeTmpDir(), 'https://example.com', 'sitemap.xml'
    )
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
    expect(xml).toContain('keep.html')
    expect(xml).toContain('followed.html') // nofollow alone still indexed
    expect(xml).not.toContain('hidden.html')
    expect(xml).not.toContain('gone.html')
    expect(xml).not.toContain('none.html')
  })

  it('does nothing when config is null', () => {
    generateSitemap(pageEntries, relativeTmpDir(), 'https://example.com', null)
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })
})

describe('generateLlmsTxt', () => {
  const pageEntries = [
    { url: 'about.html', title: 'About', description: 'About us', isIndex: false },
    { url: 'blog/post.html', title: 'First Post', description: 'A post', collection: 'blog', isIndex: false },
    { url: 'blog', title: 'blog', collection: 'blog', isIndex: true } // landing/pagination — skipped
  ]
  const config = { output: 'llms.txt', title: 'My Site', description: 'Site summary' }

  it('writes an H1 title and blockquote description', () => {
    generateLlmsTxt(pageEntries, relativeTmpDir(), 'https://example.com', config)
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt.startsWith('# My Site\n')).toBe(true)
    expect(txt).toContain('> Site summary')
  })

  it('groups by collection, uncollected pages under a lead section, and skips isIndex', () => {
    generateLlmsTxt(pageEntries, relativeTmpDir(), 'https://example.com', config)
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt).toContain('## Pages')
    expect(txt).toContain('## Blog') // humanized collection name
    expect(txt).toContain('- [About](https://example.com/about.html): About us')
    expect(txt).toContain('- [First Post](https://example.com/blog/post.html): A post')
    expect(txt).not.toContain('](https://example.com/blog)') // isIndex landing skipped
  })

  it('nests the second URL folder as an ### subsection under the first', () => {
    generateLlmsTxt(
      [
        { url: 'docs/config-reference.html', title: 'Config', isIndex: false },
        { url: 'docs/quick-start/react.html', title: 'React', isIndex: false },
        { url: 'about.html', title: 'About', isIndex: false }
      ],
      relativeTmpDir(), 'https://example.com', 'llms.txt'
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt).toContain('## Pages') // root-level page → lead section
    expect(txt).toContain('### Quick Start') // second folder = subsection
    // Quick Start is only ever an H3, never promoted to its own H2 section
    expect(txt).not.toMatch(/\n## Quick Start\n/)
    // Config sits directly under ## Docs, React under its ### Quick Start subsection
    expect(txt).toMatch(/## Docs\n\n- \[Config\][^\n]*\n\n### Quick Start\n\n- \[React\]/)
  })

  it('orders collection sections newest-first by date', () => {
    generateLlmsTxt(
      [
        { url: 'blog/old.html', title: 'Old', collection: 'blog', date: '2024-01-01', isIndex: false },
        { url: 'blog/new.html', title: 'New', collection: 'blog', date: '2026-01-01', isIndex: false },
        { url: 'blog/mid.html', title: 'Mid', collection: 'blog', date: '2025-01-01', isIndex: false }
      ],
      relativeTmpDir(), 'https://example.com', 'llms.txt'
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    const order = [...txt.matchAll(/- \[(New|Mid|Old)\]/g)].map(m => m[1])
    expect(order).toEqual(['New', 'Mid', 'Old'])
  })

  it('keeps non-collection (docs) sections in file order, not date-sorted', () => {
    generateLlmsTxt(
      [
        { url: 'docs/a.html', title: 'A', date: '2024-01-01', isIndex: false },
        { url: 'docs/b.html', title: 'B', date: '2026-01-01', isIndex: false }
      ],
      relativeTmpDir(), 'https://example.com', 'llms.txt'
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    const order = [...txt.matchAll(/- \[(A|B)\]/g)].map(m => m[1])
    expect(order).toEqual(['A', 'B']) // insertion order preserved despite B being newer
  })

  it('omits the trailing ": description" when a page has none', () => {
    generateLlmsTxt(
      [{ url: 'x.html', title: 'X', isIndex: false }],
      relativeTmpDir(), 'https://example.com', 'llms.txt'
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt).toContain('- [X](https://example.com/x.html)\n')
    expect(txt).not.toContain('[X](https://example.com/x.html):')
  })

  it('uses relative URLs when no site URL is provided', () => {
    generateLlmsTxt(
      [{ url: 'x.html', title: 'X', isIndex: false }],
      relativeTmpDir(), '', 'llms.txt'
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt).toContain('- [X](x.html)')
  })

  it('inserts an intro file between the blockquote and the first section', () => {
    const introPath = path.join(tmpDir, 'intro.md')
    fs.writeFileSync(introPath, 'Free-form context about the site.\n')
    generateLlmsTxt(
      [{ url: 'about.html', title: 'About', isIndex: false }],
      relativeTmpDir(), 'https://example.com',
      { output: 'llms.txt', title: 'T', description: 'D', intro: introPath }
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt).toMatch(/> D\n\nFree-form context about the site\.\n\n## Pages/)
  })

  it('warns and still writes when the intro file is missing', () => {
    generateLlmsTxt(
      [{ url: 'about.html', title: 'About', isIndex: false }],
      relativeTmpDir(), 'https://example.com',
      { output: 'llms.txt', title: 'T', intro: path.join(tmpDir, 'nope.md') }
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt).toContain('## Pages')
    expect(txt).not.toContain('nope')
  })

  it('excludes robots noindex pages', () => {
    generateLlmsTxt(
      [
        { url: 'keep.html', title: 'Keep', isIndex: false },
        { url: 'hidden.html', title: 'Hidden', robots: 'noindex', isIndex: false }
      ],
      relativeTmpDir(), 'https://example.com', 'llms.txt'
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms.txt'), 'utf-8')
    expect(txt).toContain('Keep')
    expect(txt).not.toContain('Hidden')
  })

  it('does nothing when config is null', () => {
    generateLlmsTxt(pageEntries, relativeTmpDir(), 'https://example.com', null)
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })
})

describe('generateLlmsFull', () => {
  // Writes a markdown source file to tmp and returns a pageEntry pointing at it
  // via _src (generateLlmsFull reads the source, not entry.content).
  const src = (name, body) => {
    const p = path.join(tmpDir, name)
    fs.writeFileSync(p, body)
    return p
  }

  it('concatenates page markdown bodies (front matter stripped) with title + URL headers', () => {
    const entries = [
      { url: 'a.html', title: 'Page A', _src: src('a.md', '---\ntitle: Page A\n---\n# Hello\n\nBody A.\n') },
      { url: 'b.html', title: 'Page B', _src: src('b.md', 'Body B, no front matter.\n') }
    ]
    generateLlmsFull(entries, relativeTmpDir(), 'https://example.com', { output: 'llms.txt', full: true })
    const txt = fs.readFileSync(path.join(tmpDir, 'llms-full.txt'), 'utf-8')
    // Body opens with its own H1 → reuse it, no wrapper `# Page A` (no double H1)
    expect(txt).toContain('# Hello\nURL: https://example.com/a.html\n\nBody A.')
    expect(txt).not.toContain('# Page A') // wrapper H1 dropped in favor of body's
    // Body without a leading H1 → wrapper title supplies the H1
    expect(txt).toContain('# Page B\nURL: https://example.com/b.html\n\nBody B, no front matter.')
    expect(txt).not.toContain('title: Page A') // front matter stripped
    expect(txt).toContain('\n\n---\n\n') // blocks joined by rule
  })

  it('opens with a corpus header naming the site, description as a blockquote', () => {
    generateLlmsFull(
      [{ url: 'a.html', title: 'A', _src: src('a.md', '# Hello\n\nBody.\n') }],
      relativeTmpDir(), 'https://example.com',
      { output: 'llms.txt', full: true, title: 'My Site', description: 'A summary.' }
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms-full.txt'), 'utf-8')
    expect(txt.startsWith('# Full Documentation Archive for My Site\n')).toBe(true)
    expect(txt).toContain('This file contains the complete Markdown documentation for My Site.')
    expect(txt).toContain('> A summary.') // description as blockquote
    expect(txt.indexOf('Archive for My Site')).toBeLessThan(txt.indexOf('# Hello')) // header before pages
  })

  it('inserts a `fullIntro` file after the header, before the pages', () => {
    const intro = src('intro-full.md', 'Licensed CC-BY. Rebuilt nightly.\n')
    generateLlmsFull(
      [{ url: 'a.html', title: 'A', _src: src('a.md', '# Hello\n\nBody.\n') }],
      relativeTmpDir(), 'https://example.com',
      { output: 'llms.txt', full: true, title: 'My Site', fullIntro: path.relative(process.cwd(), intro) }
    )
    const txt = fs.readFileSync(path.join(tmpDir, 'llms-full.txt'), 'utf-8')
    expect(txt).toContain('Licensed CC-BY. Rebuilt nightly.')
    expect(txt.indexOf('Archive for My Site')).toBeLessThan(txt.indexOf('Licensed CC-BY')) // after header
    expect(txt.indexOf('Licensed CC-BY')).toBeLessThan(txt.indexOf('# Hello')) // before pages
  })

  it('skips a missing `fullIntro` without throwing', () => {
    expect(() => generateLlmsFull(
      [{ url: 'a.html', title: 'A', _src: src('a.md', 'Body.\n') }],
      relativeTmpDir(), 'https://example.com', { full: true, title: 'S', fullIntro: 'nope.md' }
    )).not.toThrow()
    expect(fs.existsSync(path.join(tmpDir, 'llms-full.txt'))).toBe(true)
  })

  it('does nothing without the `full` flag', () => {
    generateLlmsFull(
      [{ url: 'a.html', title: 'A', _src: src('a.md', 'Body.\n') }],
      relativeTmpDir(), 'https://example.com', { output: 'llms.txt' }
    )
    expect(fs.existsSync(path.join(tmpDir, 'llms-full.txt'))).toBe(false)
  })

  it('uses a custom filename when `full` is a string', () => {
    generateLlmsFull(
      [{ url: 'a.html', title: 'A', _src: src('a.md', 'Body.\n') }],
      relativeTmpDir(), 'https://example.com', { full: 'context.txt' }
    )
    expect(fs.existsSync(path.join(tmpDir, 'context.txt'))).toBe(true)
  })

  it('derives the filename from the index `output` (-full suffix) when `full` is true', () => {
    generateLlmsFull(
      [{ url: 'a.html', title: 'A', _src: src('a.md', 'Body.\n') }],
      relativeTmpDir(), 'https://example.com', { output: 'ai.txt', full: true }
    )
    expect(fs.existsSync(path.join(tmpDir, 'ai-full.txt'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'llms-full.txt'))).toBe(false)
  })

  it('skips isIndex, noindex, and non-markdown sources', () => {
    const entries = [
      { url: 'keep.html', title: 'Keep', _src: src('keep.md', 'Keep me.\n') },
      { url: 'idx', title: 'idx', isIndex: true, _src: src('idx.md', 'Landing.\n') },
      { url: 'hidden.html', title: 'Hidden', robots: 'noindex', _src: src('hidden.md', 'Secret.\n') },
      { url: 'tpl.html', title: 'Tpl', _src: src('tpl.njk', '{% raw %}{% block x %}template{% endblock %}{% endraw %}') }
    ]
    generateLlmsFull(entries, relativeTmpDir(), 'https://example.com', { full: true })
    const txt = fs.readFileSync(path.join(tmpDir, 'llms-full.txt'), 'utf-8')
    expect(txt).toContain('Keep me.')
    expect(txt).not.toContain('Landing.')
    expect(txt).not.toContain('Secret.')
    expect(txt).not.toContain('template')
  })

  it('writes nothing when no markdown pages qualify', () => {
    generateLlmsFull(
      [{ url: 'tpl.html', title: 'Tpl', _src: src('tpl.liquid', 'liquid source') }],
      relativeTmpDir(), 'https://example.com', { full: true }
    )
    expect(fs.existsSync(path.join(tmpDir, 'llms-full.txt'))).toBe(false)
  })
})

describe('generateRobotsTxt', () => {
  const read = () => fs.readFileSync(path.join(tmpDir, 'robots.txt'), 'utf-8')

  it('defaults to allow-all with an absolute Sitemap line', () => {
    generateRobotsTxt(relativeTmpDir(), 'https://example.com/', 'robots.txt', 'sitemap.xml')
    const txt = read()
    expect(txt).toContain('User-agent: *')
    expect(txt).toContain('Disallow:\n') // empty = allow all
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml')
    expect(txt).not.toContain('https://example.com//sitemap.xml') // trailing slash stripped
  })

  it('emits Disallow/Allow lines and drops the empty allow-all line', () => {
    generateRobotsTxt(
      relativeTmpDir(), 'https://example.com',
      { output: 'robots.txt', disallow: ['/admin', '/drafts'], allow: '/admin/public' },
      'sitemap.xml'
    )
    const txt = read()
    expect(txt).toContain('Allow: /admin/public')
    expect(txt).toContain('Disallow: /admin')
    expect(txt).toContain('Disallow: /drafts')
    expect(txt).not.toMatch(/Disallow:\n/) // no empty allow-all line when rules exist
  })

  it('omits the Sitemap line when sitemap is false', () => {
    generateRobotsTxt(
      relativeTmpDir(), 'https://example.com',
      { output: 'robots.txt', sitemap: false }, 'sitemap.xml'
    )
    expect(read()).not.toContain('Sitemap:')
  })

  it('uses an explicit sitemap URL over the auto-derived one', () => {
    generateRobotsTxt(
      relativeTmpDir(), 'https://example.com',
      { output: 'robots.txt', sitemap: 'https://cdn.example.com/sm.xml' }, 'sitemap.xml'
    )
    expect(read()).toContain('Sitemap: https://cdn.example.com/sm.xml')
  })

  it('omits the Sitemap line when there is no site URL', () => {
    generateRobotsTxt(relativeTmpDir(), '', 'robots.txt', 'sitemap.xml')
    expect(read()).not.toContain('Sitemap:')
  })

  it('honours a custom user-agent', () => {
    generateRobotsTxt(
      relativeTmpDir(), '', { output: 'robots.txt', userAgent: 'Googlebot' }, null
    )
    expect(read()).toContain('User-agent: Googlebot')
  })

  it('does nothing when config is null', () => {
    generateRobotsTxt(relativeTmpDir(), 'https://example.com', null, 'sitemap.xml')
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

describe('generateFeeds', () => {
  const site = { title: 'Ex', description: 'Site desc', author: 'Jane', lang: 'en' }
  const entries = [
    { url: 'blog', title: 'Blog', isIndex: true },
    { url: 'blog/newer.html', title: 'Newer', description: 'Newer post', date: '2026-02-01', collection: 'blog', author: 'Ann', isIndex: false },
    { url: 'blog/older.html', title: 'Older', excerpt: 'Older excerpt', date: '2026-01-01', collection: 'blog', isIndex: false },
    { url: 'about.html', title: 'About', isIndex: false } // not in a collection
  ]
  const read = (rel) => fs.readFileSync(path.join(tmpDir, rel), 'utf-8')

  it('does nothing when config is null', () => {
    generateFeeds(entries, relativeTmpDir(), 'https://ex.com', null, site)
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })

  it('generates a per-collection RSS with items newest-first, absolute URLs', () => {
    generateFeeds(entries, relativeTmpDir(), 'https://ex.com/', { collection: 'blog', output: 'blog/feed.rss' }, site)
    const xml = read('blog/feed.rss')
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<title>Blog | Ex</title>')
    expect(xml).toContain('<link>https://ex.com/blog</link>')
    expect(xml).toContain('<atom:link href="https://ex.com/blog/feed.rss" rel="self"')
    // newest post first, absolute link/guid, description falls back to excerpt
    expect(xml.indexOf('Newer')).toBeLessThan(xml.indexOf('Older'))
    expect(xml).toContain('<link>https://ex.com/blog/newer.html</link>')
    expect(xml).toContain('<description>Older excerpt</description>')
    expect(xml).toContain('<pubDate>Sun, 01 Feb 2026 00:00:00 GMT</pubDate>')
    // the non-collection page is excluded
    expect(xml).not.toContain('About')
  })

  it('generates Atom with entry ids and author when type is atom', () => {
    generateFeeds(entries, relativeTmpDir(), 'https://ex.com', { collection: 'blog', type: 'atom' }, site)
    const xml = read('blog/feed.xml') // bare filename → collection folder
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">')
    expect(xml).toContain('<id>https://ex.com/blog/newer.html</id>')
    expect(xml).toContain('<updated>2026-02-01T00:00:00.000Z</updated>')
    expect(xml).toContain('<author><name>Ann</name></author>') // per-entry author
    expect(xml).toContain('<summary>Older excerpt</summary>')
  })

  it('respects limit and drops noindex posts', () => {
    const many = [
      { url: 'blog/a.html', title: 'A', date: '2026-01-03', collection: 'blog', isIndex: false },
      { url: 'blog/b.html', title: 'B', date: '2026-01-02', collection: 'blog', isIndex: false, robots: 'noindex' },
      { url: 'blog/c.html', title: 'C', date: '2026-01-01', collection: 'blog', isIndex: false }
    ]
    generateFeeds(many, relativeTmpDir(), 'https://ex.com', { collection: 'blog', limit: 1 }, site)
    const xml = read('blog/feed.xml')
    expect((xml.match(/<item>/g) || []).length).toBe(1)
    expect(xml).toContain('>A</title>')
    expect(xml).not.toContain('>B</title>') // noindex excluded even before the cap
  })

  it('with no collection, emits a feed for every collection present', () => {
    const multi = [
      { url: 'blog/p.html', title: 'P', date: '2026-01-01', collection: 'blog', isIndex: false },
      { url: 'news/q.html', title: 'Q', date: '2026-01-01', collection: 'news', isIndex: false }
    ]
    generateFeeds(multi, relativeTmpDir(), 'https://ex.com', true, site)
    expect(fs.existsSync(path.join(tmpDir, 'blog/feed.xml'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'news/feed.xml'))).toBe(true)
  })

  it('escapes XML-unsafe characters in titles and descriptions', () => {
    const nasty = [{ url: 'blog/x.html', title: 'A & B <c>', description: '"q" > p', date: '2026-01-01', collection: 'blog', isIndex: false }]
    generateFeeds(nasty, relativeTmpDir(), 'https://ex.com', { collection: 'blog' }, site)
    const xml = read('blog/feed.xml')
    expect(xml).toContain('<title>A &amp; B &lt;c&gt;</title>')
    expect(xml).toContain('&quot;q&quot; &gt; p')
  })

  describe('content: true (full-content encoding)', () => {
    const src = (name, body) => {
      const p = path.join(tmpDir, name)
      fs.writeFileSync(p, body)
      return p
    }

    it('adds <content:encoded> with rendered article HTML and the content namespace', () => {
      const entries = [{ url: 'blog/p.html', title: 'P', date: '2026-01-01', collection: 'blog', isIndex: false, _src: src('p.md', '# Hi\n\nHello **world**.\n') }]
      generateFeeds(entries, relativeTmpDir(), 'https://ex.com', { collection: 'blog', content: true }, site)
      const xml = read('blog/feed.xml') // default filename
      expect(xml).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"')
      expect(xml).toContain('<content:encoded><![CDATA[')
      expect(xml).toContain('Hello <strong>world</strong>.') // rendered markdown, not raw
    })

    it('omits the content namespace and element by default (unchanged output)', () => {
      const entries = [{ url: 'blog/p.html', title: 'P', date: '2026-01-01', collection: 'blog', isIndex: false, _src: src('p2.md', 'Body.\n') }]
      generateFeeds(entries, relativeTmpDir(), 'https://ex.com', { collection: 'blog' }, site)
      const xml = read('blog/feed.xml')
      expect(xml).not.toContain('content:encoded')
      expect(xml).not.toContain('xmlns:content')
    })

    it('skips the element for non-markdown sources but keeps the item', () => {
      const entries = [{ url: 'blog/t.html', title: 'T', date: '2026-01-01', collection: 'blog', isIndex: false, _src: src('t.njk', '{% block x %}x{% endblock %}') }]
      generateFeeds(entries, relativeTmpDir(), 'https://ex.com', { collection: 'blog', content: true }, site)
      const xml = read('blog/feed.xml')
      expect(xml).toContain('>T</title>') // item still present
      expect(xml).not.toContain('<content:encoded>') // no clean body → omitted
    })

    it('splits a literal ]]> so it cannot close the CDATA early', () => {
      const entries = [{ url: 'blog/c.html', title: 'C', date: '2026-01-01', collection: 'blog', isIndex: false, _src: src('c.md', '<div>a]]>b</div>\n') }]
      generateFeeds(entries, relativeTmpDir(), 'https://ex.com', { collection: 'blog', content: true }, site)
      const xml = read('blog/feed.xml')
      expect(xml).toContain(']]]]><![CDATA[>') // the escape splice
      expect(xml).not.toMatch(/a]]>b/) // no unescaped ]]> survives in the payload
    })

    it('adds <content type="html"> for Atom feeds', () => {
      const entries = [{ url: 'blog/p.html', title: 'P', date: '2026-01-01', collection: 'blog', isIndex: false, _src: src('p3.md', 'Hello.\n') }]
      generateFeeds(entries, relativeTmpDir(), 'https://ex.com', { collection: 'blog', type: 'atom', content: true }, site)
      const xml = read('blog/feed.xml')
      expect(xml).toContain('<content type="html"><![CDATA[')
      expect(xml).toContain('Hello.')
    })
  })
})

describe('out vs the deprecated output key', () => {
  const entries = [
    { url: 'blog', title: 'Blog', isIndex: true },
    { url: 'blog/post.html', title: 'Post', date: '2026-01-01', collection: 'blog', isIndex: false }
  ]

  it('writes to the path named by out', () => {
    generateSearchIndex(entries, relativeTmpDir(), { out: 'idx.json' })
    generateSitemap(entries, relativeTmpDir(), 'https://ex.com', { out: 'map.xml' })
    generateNav(entries, relativeTmpDir(), { out: 'menu.json' })
    generateFeeds(entries, relativeTmpDir(), 'https://ex.com', { collection: 'blog', out: 'blog/rss.xml' }, {})

    for (const f of ['idx.json', 'map.xml', 'menu.json', path.join('blog', 'rss.xml')]) {
      expect(fs.existsSync(path.join(tmpDir, f))).toBe(true)
    }
  })

  // 1.x spelling: honoured through 2.x so a rename doesn't silently stop
  // writing someone's sitemap, and warned so they know it is on the clock
  it('still honours output, and says so once', () => {
    const warn = jest.spyOn(console, 'log').mockImplementation(() => {})
    generateSitemap(entries, relativeTmpDir(), 'https://ex.com', { output: 'legacy.xml' })
    generateSitemap(entries, relativeTmpDir(), 'https://ex.com', { output: 'legacy.xml' })

    expect(fs.existsSync(path.join(tmpDir, 'legacy.xml'))).toBe(true)
    const lines = warn.mock.calls.map((args) => args.join(' ')).filter((l) => l.includes('sitemap.output'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('is now "markup.options.sitemap.out"')
    jest.restoreAllMocks()
  })

  it('lets out win when both are set', () => {
    generateSitemap(entries, relativeTmpDir(), 'https://ex.com', { out: 'wins.xml', output: 'loses.xml' })
    expect(fs.existsSync(path.join(tmpDir, 'wins.xml'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'loses.xml'))).toBe(false)
  })
})
