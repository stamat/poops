import { afterEach, it, describe, expect } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  replaceOutExtensions,
  getUpDirPrefix,
  getRelativePathPrefix,
  getPageUrl,
  getPageUrlRelativeToOutput,
  parseFrontMatter,
  clearFrontMatterCache,
  discoverImageVariants,
  groupby,
  decodeTemplateEntities,
  renderToc
} from '../helpers.js'
import { clearImageCache } from '../image-cache.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UTILS_FIXTURES = path.join(__dirname, '..', '..', 'utils', '__tests__', 'fixtures', 'helpers')
const TMP = path.join(__dirname, 'fixtures', '_tmp')

afterEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true })
  clearFrontMatterCache()
  clearImageCache()
})

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
  it('returns ./ when outputDir is cwd', () => {
    expect(getRelativePathPrefix(process.cwd())).toBe('./')
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

  it('returns baseURL with trailing slash when provided', () => {
    expect(getRelativePathPrefix(process.cwd(), null, '/blog')).toBe('/blog/')
  })

  it('returns baseURL as-is when it already has trailing slash', () => {
    expect(getRelativePathPrefix(process.cwd(), null, '/blog/')).toBe('/blog/')
  })

  it('baseURL overrides relative path calculation', () => {
    const outputDir = path.join(process.cwd(), 'dist', 'pages')
    expect(getRelativePathPrefix(outputDir, null, '/blog')).toBe('/blog/')
  })
})

describe('getPageUrl', () => {
  it('returns directory for index files', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'about', 'index.html')
    expect(getPageUrl(outputPath)).toBe('dist/about')
  })

  it('returns file path for non-index files', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'page.html')
    expect(getPageUrl(outputPath)).toBe('dist/page.html')
  })

  it('replaces .njk extension before checking', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'index.njk')
    expect(getPageUrl(outputPath)).toBe('dist')
  })

  it('replaces .md extension before checking', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'post.md')
    expect(getPageUrl(outputPath)).toBe('dist/post.html')
  })
})

describe('getPageUrlRelativeToOutput', () => {
  it('returns URL relative to the output directory', () => {
    const outputPath = path.join(process.cwd(), 'example', 'dist', 'blog', 'post.html')
    expect(getPageUrlRelativeToOutput(outputPath, 'example/dist')).toBe('blog/post.html')
  })

  it('returns empty string for index at output root', () => {
    const outputPath = path.join(process.cwd(), 'dist', 'index.html')
    expect(getPageUrlRelativeToOutput(outputPath, 'dist')).toBe('')
  })

  it('handles nested paths', () => {
    const outputPath = path.join(process.cwd(), 'out', 'docs', 'api', 'page.njk')
    expect(getPageUrlRelativeToOutput(outputPath, 'out')).toBe('docs/api/page.html')
  })
})

// --- Front matter ---

describe('parseFrontMatter', () => {
  it('extracts front matter and content', () => {
    const result = parseFrontMatter(path.join(UTILS_FIXTURES, 'front-matter', 'with-fm.md'))
    expect(result.frontMatter.title).toBe('Test Post')
    expect(result.frontMatter.date).toBe('2024-01-15')
    expect(result.frontMatter.tags).toEqual(['javascript', 'testing'])
    expect(result.content).toContain('# Hello World')
    expect(result.content).not.toContain('---')
  })

  it('returns empty front matter when none present', () => {
    const result = parseFrontMatter(path.join(UTILS_FIXTURES, 'front-matter', 'without-fm.md'))
    expect(result.frontMatter).toEqual({})
    expect(result.content).toContain('# No Front Matter')
  })

  it('throws for nonexistent file', () => {
    expect(() => parseFrontMatter('/nonexistent/file.md')).toThrow('Error stating file')
  })

  it('caches results and returns a copy of frontMatter', () => {
    const filePath = path.join(UTILS_FIXTURES, 'front-matter', 'with-fm.md')
    const first = parseFrontMatter(filePath)
    const second = parseFrontMatter(filePath)
    expect(second.frontMatter).toEqual(first.frontMatter)
    first.frontMatter.title = 'mutated'
    expect(second.frontMatter.title).toBe('Test Post')
  })
})

describe('clearFrontMatterCache', () => {
  it('clears cache for a specific file', () => {
    const filePath = path.join(UTILS_FIXTURES, 'front-matter', 'with-fm.md')
    parseFrontMatter(filePath)
    clearFrontMatterCache(filePath)
  })

  it('clears entire cache when called without arguments', () => {
    parseFrontMatter(path.join(UTILS_FIXTURES, 'front-matter', 'with-fm.md'))
    parseFrontMatter(path.join(UTILS_FIXTURES, 'front-matter', 'without-fm.md'))
    clearFrontMatterCache()
  })
})

// --- groupby ---

describe('groupby', () => {
  it('groups items by a string field', () => {
    const items = [
      { title: 'A', category: 'tech' },
      { title: 'B', category: 'art' },
      { title: 'C', category: 'tech' }
    ]
    const result = groupby(items, 'category')
    expect(result).toEqual([
      { key: 'tech', items: [items[0], items[2]] },
      { key: 'art', items: [items[1]] }
    ])
  })

  it('groups by date year', () => {
    const items = [
      { title: 'A', date: '2024-03-15' },
      { title: 'B', date: '2023-07-01' },
      { title: 'C', date: '2024-11-20' }
    ]
    const result = groupby(items, 'date', 'year')
    expect(result).toEqual([
      { key: '2024', items: [items[0], items[2]] },
      { key: '2023', items: [items[1]] }
    ])
  })

  it('groups by date month', () => {
    const items = [
      { title: 'A', date: '2024-01-10' },
      { title: 'B', date: '2024-03-05' },
      { title: 'C', date: '2024-01-25' }
    ]
    const result = groupby(items, 'date', 'month')
    expect(result).toEqual([
      { key: '1', items: [items[0], items[2]] },
      { key: '3', items: [items[1]] }
    ])
  })

  it('returns empty array for non-array input', () => {
    expect(groupby(null, 'key')).toEqual([])
    expect(groupby(undefined, 'key')).toEqual([])
    expect(groupby('string', 'key')).toEqual([])
  })

  it('uses empty string key for missing field values', () => {
    const items = [{ title: 'A' }, { title: 'B', category: 'tech' }]
    const result = groupby(items, 'category')
    expect(result).toEqual([
      { key: '', items: [items[0]] },
      { key: 'tech', items: [items[1]] }
    ])
  })

  it('preserves insertion order of groups', () => {
    const items = [
      { date: '2022-01-01' },
      { date: '2024-06-01' },
      { date: '2023-03-01' },
      { date: '2024-12-01' }
    ]
    const result = groupby(items, 'date', 'year')
    expect(result.map(g => g.key)).toEqual(['2022', '2024', '2023'])
  })
})

// --- decodeTemplateEntities ---

describe('decodeTemplateEntities', () => {
  it('decodes quotes inside {% %} and {{ }} tags', () => {
    const input = '{% set x = a | groupby(&quot;date&quot;, &#39;year&#39;) %}<h2>{{ x }}</h2>'
    expect(decodeTemplateEntities(input)).toBe('{% set x = a | groupby("date", \'year\') %}<h2>{{ x }}</h2>')
  })

  it('leaves entities outside tags untouched', () => {
    const input = '<p>A &amp; B say &quot;hi&quot;</p>{{ x &gt; 5 }}'
    expect(decodeTemplateEntities(input)).toBe('<p>A &amp; B say &quot;hi&quot;</p>{{ x > 5 }}')
  })
})

// --- Image variant discovery ---

describe('discoverImageVariants', () => {
  it('discovers variants and prefers webp for srcset', () => {
    const result = discoverImageVariants('images/photo.jpg', UTILS_FIXTURES)
    expect(result.variants.length).toBe(3)
    expect(result.variants.every(v => v.format === 'webp')).toBe(true)
    expect(result.variants.map(v => v.width)).toEqual([320, 640, 960])
    expect(result.variants[0].path).toBe('images/photo-320w.webp')
  })

  it('uses middle-sized original format variant as src fallback', () => {
    const result = discoverImageVariants('images/photo.jpg', UTILS_FIXTURES)
    expect(result.src).toBe('images/photo-640w.jpg')
  })

  it('returns original path and empty variants when no matches', () => {
    const result = discoverImageVariants('images/nonexistent.jpg', UTILS_FIXTURES)
    expect(result.src).toBe('images/nonexistent.jpg')
    expect(result.variants).toEqual([])
  })

  it('returns original path when directory does not exist', () => {
    const result = discoverImageVariants('nope/photo.jpg', UTILS_FIXTURES)
    expect(result.src).toBe('nope/photo.jpg')
    expect(result.variants).toEqual([])
  })

  it('falls back to original format when no preferred format exists', () => {
    const dir = path.join(TMP, 'img')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'icon-100w.png'), '')
    fs.writeFileSync(path.join(dir, 'icon-200w.png'), '')

    const result = discoverImageVariants('img/icon.png', TMP)
    expect(result.variants.length).toBe(2)
    expect(result.variants.every(v => v.format === 'png')).toBe(true)
    expect(result.src).toBe('img/icon-100w.png')
  })

  it('sorts variants by width', () => {
    const dir = path.join(TMP, 'sorted')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'pic-960w.jpg'), '')
    fs.writeFileSync(path.join(dir, 'pic-320w.jpg'), '')
    fs.writeFileSync(path.join(dir, 'pic-640w.jpg'), '')

    const result = discoverImageVariants('sorted/pic.jpg', TMP)
    expect(result.variants.map(v => v.width)).toEqual([320, 640, 960])
  })

  it('prefers avif over webp when available', () => {
    const dir = path.join(TMP, 'avif')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'hero-320w.webp'), '')
    fs.writeFileSync(path.join(dir, 'hero-640w.webp'), '')
    fs.writeFileSync(path.join(dir, 'hero-320w.avif'), '')
    fs.writeFileSync(path.join(dir, 'hero-640w.avif'), '')
    fs.writeFileSync(path.join(dir, 'hero-320w.jpg'), '')

    const result = discoverImageVariants('avif/hero.jpg', TMP)
    expect(result.variants.every(v => v.format === 'avif')).toBe(true)
    expect(result.variants.length).toBe(2)
  })
})

describe('discoverImageVariants with poops-images cache', () => {
  function writeCache(dir, entries) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, '.poops-images-cache.json'), JSON.stringify({ configHash: 'abc', entries }))
  }

  it('reads variants and dimensions from the cache, no files on disk needed', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpg': {
        width: 4400,
        height: 3300,
        exif: null,
        outputs: [
          { path: 'photo.jpg', width: 4400, height: 3300 },
          { path: 'photo-320w.jpg', width: 320, height: 240 },
          { path: 'photo-640w.jpg', width: 640, height: 480 },
          { path: 'photo-960w.jpg', width: 960, height: 720 }
        ]
      }
    })

    const result = discoverImageVariants('images/photo.jpg', TMP)
    expect(result.variants.map(v => v.width)).toEqual([320, 640, 960])
    expect(result.variants[0].path).toBe('images/photo-320w.jpg')
    expect(result.src).toBe('images/photo-640w.jpg')
    expect(result.width).toBe(640)
    expect(result.height).toBe(480)
  })

  it('excludes named sizes and preprocessed outputs from srcset', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpg': {
        width: 4400,
        height: 3300,
        exif: null,
        outputs: [
          { path: 'photo.jpg', width: 4400, height: 3300 },
          { path: 'photo-640w.jpg', width: 640, height: 480 },
          { path: 'photo-thumb-200w.jpg', width: 200, height: 200 },
          { path: 'photo-banner-1200w.jpg', width: 1200, height: 400 },
          { path: 'photo-blurred-640w.jpg', width: 640, height: 480 },
          { path: 'photo-lqip-32w.jpg', width: 32, height: 24 },
          { path: 'photo-halftone.svg', width: null, height: null }
        ]
      }
    })

    const result = discoverImageVariants('images/photo.jpg', TMP)
    expect(result.variants.map(v => v.path)).toEqual(['images/photo-640w.jpg'])
  })

  it('prefers webp variants for srcset from cache outputs', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpg': {
        width: 1000,
        height: 800,
        exif: null,
        outputs: [
          { path: 'photo-320w.jpg', width: 320, height: 256 },
          { path: 'photo-640w.jpg', width: 640, height: 512 },
          { path: 'photo-320w.webp', width: 320, height: 256 },
          { path: 'photo-640w.webp', width: 640, height: 512 }
        ]
      }
    })

    const result = discoverImageVariants('images/photo.jpg', TMP)
    expect(result.variants.every(v => v.format === 'webp')).toBe(true)
    expect(result.src).toBe('images/photo-320w.jpg')
  })

  it('uses the converted base output as src when there are no size variants', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.heic': {
        width: 3024,
        height: 4032,
        exif: null,
        outputs: [{ path: 'photo.jpg', width: 3024, height: 4032 }]
      }
    })

    const result = discoverImageVariants('images/photo.heic', TMP)
    expect(result.src).toBe('images/photo.jpg')
    expect(result.variants).toEqual([])
    expect(result.width).toBe(3024)
    expect(result.height).toBe(4032)
  })

  it('treats a jpeg source and jpg variants as the same format for the src fallback', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpeg': {
        width: 3024,
        height: 4032,
        exif: null,
        outputs: [
          { path: 'photo.jpg', width: 3024, height: 4032 },
          { path: 'photo-480w.jpg', width: 480, height: 640 },
          { path: 'photo-480w.webp', width: 480, height: 640 }
        ]
      }
    })

    const result = discoverImageVariants('images/photo.jpeg', TMP)
    expect(result.src).toBe('images/photo-480w.jpg')
    expect(result.variants.map(v => v.format)).toEqual(['webp'])
  })

  it('falls back to directory scan when there is no cache', () => {
    const dir = path.join(TMP, 'nocache')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'pic-320w.jpg'), '')

    const result = discoverImageVariants('nocache/pic.jpg', TMP)
    expect(result.variants.length).toBe(1)
    expect(result.width).toBeUndefined()
  })
})

describe('renderToc', () => {
  it('builds a nested H2/H3 TOC from rendered heading ids', () => {
    const html = '<h2 id="a">Alpha</h2><p>x</p><h3 id="b">Beta</h3><h2 id="c">Gamma</h2>'
    const toc = renderToc(html)
    expect(toc).toContain('<nav class="toc"')
    expect(toc).toContain('<li class="toc-h2"><a href="#a">Alpha</a></li>')
    expect(toc).toContain('<li class="toc-h3"><a href="#b">Beta</a></li>')
    expect(toc).toContain('<li class="toc-h2"><a href="#c">Gamma</a></li>')
  })

  it('ignores H1/H4+, strips inline markup, drops headings without an id', () => {
    const html = '<h1 id="t">Title</h1><h2 id="s"><code>run</code> it</h2><h4 id="d">Deep</h4><h2>no id</h2>'
    const toc = renderToc(html)
    expect(toc).toContain('<a href="#s">run it</a>')
    expect(toc).not.toContain('Title')
    expect(toc).not.toContain('Deep')
    expect(toc).not.toContain('no id')
  })

  it('returns empty string when there are no H2/H3 headings', () => {
    expect(renderToc('<p>nothing here</p>')).toBe('')
    expect(renderToc('')).toBe('')
  })
})
