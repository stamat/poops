import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSingleCollectionData, generateCollectionPaginationPages, buildTaxonomyData, generateTaxonomyPages } from '../collections.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, '_tmp-collections')

// getSingleCollectionData resolves against process.cwd()
const originalCwd = process.cwd()
let logSpy

beforeEach(() => {
  fs.mkdirSync(path.join(TMP, 'src', 'posts'), { recursive: true })
  process.chdir(TMP)
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  process.chdir(originalCwd)
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('date fallback for undated collection items', () => {
  it('uses mtime and logs a warning', () => {
    const post = path.join(TMP, 'src', 'posts', 'undated.md')
    fs.writeFileSync(post, '---\ntitle: Undated\n---\nhello\n')
    const mtime = new Date('2020-05-04T03:02:00Z')
    fs.utimesSync(post, mtime, mtime)

    const [item] = getSingleCollectionData('src', 'posts')

    expect(item.date).toBe('2020-05-04T03:02')
    const warned = logSpy.mock.calls.some(args => String(args[0]).includes('mtime'))
    expect(warned).toBe(true)
  })

  it('keeps the front-matter date and stays quiet when one is set', () => {
    const post = path.join(TMP, 'src', 'posts', 'dated.md')
    fs.writeFileSync(post, '---\ntitle: Dated\ndate: 2024-01-15\n---\nhello\n')

    const [item] = getSingleCollectionData('src', 'posts')

    expect(item.date).toBe('2024-01-15')
    const warned = logSpy.mock.calls.some(args => String(args[0]).includes('mtime'))
    expect(warned).toBe(false)
  })
})

describe('generateCollectionPaginationPages', () => {
  const collectionData = () => ({
    posts: {
      name: 'posts',
      items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
      paginate: 1,
      pages: [[{ title: 'a' }], [{ title: 'b' }], [{ title: 'c' }]],
      totalPages: 3
    }
  })

  it('creates no pagination dirs when the collection has no index file', async() => {
    const compileEntryFn = jest.fn()

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn))

    expect(compileEntryFn).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(TMP, 'dist', 'posts'))).toBe(false)
  })

  it('writes nothing when the index page is skipped (published: false)', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\npublished: false\n---\n')
    const compileEntryFn = jest.fn().mockResolvedValue({ result: '', skipped: true })

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn))

    expect(compileEntryFn).toHaveBeenCalledTimes(3)
    expect(fs.existsSync(path.join(TMP, 'dist', 'posts'))).toBe(false)
  })

  it('gives pages 2..N a distinct "— Page N" title, page 1 keeps its own', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    const compileEntryFn = jest.fn().mockResolvedValue({ result: 'x' })

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn))

    const p1 = compileEntryFn.mock.calls.find(([, c]) => c.posts.pageNumber === 1)
    const p2 = compileEntryFn.mock.calls.find(([, c]) => c.posts.pageNumber === 2)
    expect(p1[1]._page).toBeUndefined() // page 1 keeps its front-matter title
    expect(p2[1]._page.title).toBe('Posts — Page 2')
  })

  it('localizes the "— Page N" title via site.pagination.title', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    const compileEntryFn = jest.fn().mockResolvedValue({ result: 'x' })
    const site = { pagination: { title: '{title} — Seite {n}/{total}' } }

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn, undefined, site))

    const p2 = compileEntryFn.mock.calls.find(([, c]) => c.posts.pageNumber === 2)
    expect(p2[1]._page.title).toBe('Posts — Seite 2/3')
  })

  it('writes every pagination page when the index compiles', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    const compileEntryFn = jest.fn().mockResolvedValue({ result: '<html>page</html>' })

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn))

    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', 'index.html'), 'utf-8')).toBe('<html>page</html>')
    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', '2', 'index.html'), 'utf-8')).toBe('<html>page</html>')
    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', '3', 'index.html'), 'utf-8')).toBe('<html>page</html>')
  })

  it('prunes stale pagination dirs when the page count shrinks', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    for (const n of ['2', '3', '4']) {
      fs.mkdirSync(path.join(TMP, 'dist', 'posts', n), { recursive: true })
      fs.writeFileSync(path.join(TMP, 'dist', 'posts', n, 'index.html'), 'old')
    }
    const compileEntryFn = jest.fn().mockResolvedValue({ result: '<html>page</html>' })

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn))

    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', '3'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', '4'))).toBe(false)
  })

  it('prunes all pagination dirs when the index file is gone', async() => {
    fs.mkdirSync(path.join(TMP, 'dist', 'posts', '2'), { recursive: true })
    fs.writeFileSync(path.join(TMP, 'dist', 'posts', '2', 'index.html'), 'old')

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', jest.fn()))

    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', '2'))).toBe(false)
  })

  it('keeps numeric dirs mirrored from real source dirs', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    fs.mkdirSync(path.join(TMP, 'src', 'posts', '7'), { recursive: true })
    fs.mkdirSync(path.join(TMP, 'dist', 'posts', '7'), { recursive: true })
    fs.writeFileSync(path.join(TMP, 'dist', 'posts', '7', 'index.html'), 'real page')
    const compileEntryFn = jest.fn().mockResolvedValue({ result: '<html>page</html>' })

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn))

    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', '7', 'index.html'), 'utf-8')).toBe('real page')
  })
})

describe('taxonomies', () => {
  // paginate 2 so the "js" term (3 posts) spills onto a second page
  const collectionData = () => ({
    posts: {
      name: 'posts',
      items: [
        { title: 'a', tags: ['js', 'css'] },
        { title: 'b', tags: ['js'] },
        { title: 'c', tags: ['js'] }
      ],
      _taxonomies: [{ name: 'tags', path: 'tag', paginate: 2 }]
    }
  })

  it('groups array-valued tags into terms with slug, url and count', () => {
    const data = collectionData()
    buildTaxonomyData(data)

    const [tax] = data.posts.taxonomies
    expect(tax.path).toBe('tag')
    const js = tax.terms.find(t => t.term === 'js')
    expect(js.count).toBe(3)
    expect(js.slug).toBe('js')
    expect(js.url).toBe('posts/tag/js')
    expect(js.totalPages).toBe(2)
    expect(tax.terms.find(t => t.term === 'css').count).toBe(1)
  })

  it('writes a paginated page per term using the collection index template', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    const data = collectionData()
    buildTaxonomyData(data)
    const compileEntryFn = jest.fn().mockResolvedValue({ result: '<html>term</html>' })

    await Promise.all(generateTaxonomyPages(data, 'src', 'dist', compileEntryFn))

    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', 'tag', 'js', 'index.html'), 'utf-8')).toBe('<html>term</html>')
    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', 'tag', 'js', '2', 'index.html'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', 'tag', 'css', 'index.html'))).toBe(true)
    // css has one post → no second page
    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', 'tag', 'css', '2'))).toBe(false)
  })

  it('passes term-filtered pageItems and activeTerm to the template', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    const data = collectionData()
    buildTaxonomyData(data)
    const compileEntryFn = jest.fn().mockResolvedValue({ result: 'x' })

    await Promise.all(generateTaxonomyPages(data, 'src', 'dist', compileEntryFn))

    const cssCall = compileEntryFn.mock.calls.find(([, ctx]) => ctx.posts.activeTerm === 'css')
    expect(cssCall[1].posts.activeTaxonomy).toBe('tag')
    expect(cssCall[1].posts.pageItems).toEqual([{ title: 'a', tags: ['js', 'css'] }])
  })

  it('sets a distinct "Tag: Term" title per term, suffixed on later pages', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    const data = collectionData()
    buildTaxonomyData(data)
    const compileEntryFn = jest.fn().mockResolvedValue({ result: 'x' })

    await Promise.all(generateTaxonomyPages(data, 'src', 'dist', compileEntryFn))

    const js1 = compileEntryFn.mock.calls.find(([, c]) => c.posts.activeTerm === 'js' && c.posts.pageNumber === 1)
    const js2 = compileEntryFn.mock.calls.find(([, c]) => c.posts.activeTerm === 'js' && c.posts.pageNumber === 2)
    expect(js1[1]._page.title).toBe('Tag: Js')
    expect(js2[1]._page.title).toBe('Tag: Js — Page 2')
  })

  it('prunes stale term dirs for tags that no longer exist', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    fs.mkdirSync(path.join(TMP, 'dist', 'posts', 'tag', 'removed'), { recursive: true })
    fs.writeFileSync(path.join(TMP, 'dist', 'posts', 'tag', 'removed', 'index.html'), 'old')
    const data = collectionData()
    buildTaxonomyData(data)

    await Promise.all(generateTaxonomyPages(data, 'src', 'dist', jest.fn().mockResolvedValue({ result: 'x' })))

    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', 'tag', 'removed'))).toBe(false)
    expect(fs.existsSync(path.join(TMP, 'dist', 'posts', 'tag', 'js'))).toBe(true)
  })
})
