import { afterEach, beforeEach, it, describe, expect } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Markups from '../../markups.js'
import { clearFrontMatterCache } from '../helpers.js'

// Covers the checksum update index through a real build: what moves a page's
// `updated` date, what deliberately does not, where the date surfaces, and what
// the committed index file looks like.
//
// Deliberately not covered: that a build actually ran before the commit. The
// whole feature rests on that habit and no test can observe it — the index
// records what the last build saw, so a commit without one carries a stale
// hash and the next build stamps that page with whatever mtime it then has.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, '_tmp-update-index')
const INDEX = path.join(TMP, '.poops-updates.json')
const originalCwd = process.cwd()

const EDITED = new Date('2026-03-01T10:00:00.000Z')
const LATER = new Date('2026-06-15T08:30:00.000Z')

function build(options = {}) {
  return new Markups({ markup: { in: 'src', out: 'dist', options: { lastUpdated: true, ...options } } }).compile()
}

function write(rel, content, mtime = EDITED) {
  const file = path.join(TMP, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  fs.utimesSync(file, mtime, mtime)
}

function readIndex() {
  return JSON.parse(fs.readFileSync(INDEX, 'utf8'))
}

function readOut(rel) {
  return fs.readFileSync(path.join(TMP, 'dist', rel), 'utf8')
}

beforeEach(() => {
  fs.mkdirSync(path.join(TMP, 'src'), { recursive: true })
  process.chdir(TMP)
  // fixed mtimes across tests would otherwise let one test read the previous
  // test's parsed front matter for the same path
  clearFrontMatterCache()
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('the checksum update index', () => {
  it('stamps a page it has never seen with that file\'s mtime', async() => {
    write('src/post.md', '---\ntitle: Post\n---\nbody')
    await build()

    expect(readIndex()['src/post.md'].updated).toBe(EDITED.toISOString())
  })

  it('keeps the date across a rebuild that changed nothing, even when the file was touched', async() => {
    write('src/post.md', '---\ntitle: Post\n---\nbody')
    await build()

    fs.utimesSync(path.join(TMP, 'src', 'post.md'), LATER, LATER)
    clearFrontMatterCache()
    await build()

    expect(readIndex()['src/post.md'].updated).toBe(EDITED.toISOString())
  })

  it('moves the date when the body changes', async() => {
    write('src/post.md', '---\ntitle: Post\n---\nbody')
    await build()

    write('src/post.md', '---\ntitle: Post\n---\nbody, rewritten', LATER)
    clearFrontMatterCache()
    await build()

    expect(readIndex()['src/post.md'].updated).toBe(LATER.toISOString())
  })

  it('leaves the date alone when only front matter changes — a retitle is not an edit', async() => {
    write('src/post.md', '---\ntitle: Post\n---\nbody')
    await build()

    write('src/post.md', '---\ntitle: Renamed Post\ntags: [news]\n---\nbody', LATER)
    clearFrontMatterCache()
    await build()

    expect(readIndex()['src/post.md'].updated).toBe(EDITED.toISOString())
  })

  it('touches only the page that changed', async() => {
    write('src/one.md', '---\ntitle: One\n---\none')
    write('src/two.md', '---\ntitle: Two\n---\ntwo')
    await build()

    write('src/two.md', '---\ntitle: Two\n---\ntwo, rewritten', LATER)
    clearFrontMatterCache()
    await build()

    const index = readIndex()
    expect(index['src/one.md'].updated).toBe(EDITED.toISOString())
    expect(index['src/two.md'].updated).toBe(LATER.toISOString())
  })

  it('hands the date to the template as page.updated', async() => {
    write('src/post.njk', '---\ntitle: Post\n---\nedited {{ page.updated }}')
    await build()

    expect(readOut('post.html')).toContain(`edited ${EDITED.toISOString()}`)
  })

  it('gives the sitemap a lastmod even for a page with no date in front matter', async() => {
    write('src/post.md', '---\ntitle: Post\n---\nbody')
    await build({ sitemap: 'sitemap.xml', site: { url: 'https://example.com' } })

    expect(readOut('sitemap.xml')).toContain('<lastmod>2026-03-01</lastmod>')
  })

  it('prefers the edit date over the published date in the sitemap', async() => {
    write('src/post.md', '---\ntitle: Post\ndate: 2020-01-01\n---\nbody')
    await build({ sitemap: 'sitemap.xml', site: { url: 'https://example.com' } })

    const xml = readOut('sitemap.xml')
    expect(xml).toContain('<lastmod>2026-03-01</lastmod>')
    expect(xml).not.toContain('<lastmod>2020-01-01</lastmod>')
  })

  it('stands aside for a hand-written updated, and keeps that page out of the index', async() => {
    write('src/post.njk', '---\ntitle: Post\nupdated: 2019-07-07\n---\nedited {{ page.updated }}')
    write('src/other.md', '---\ntitle: Other\n---\nother')
    await build()

    expect(readOut('post.html')).toContain('edited 2019-07-07')
    expect(readIndex()['src/post.njk']).toBeUndefined()
    expect(readIndex()['src/other.md']).toBeDefined()
  })

  it('leaves layouts and partials out — a date belongs to a page', async() => {
    fs.mkdirSync(path.join(TMP, 'src', '_partials'), { recursive: true })
    write('src/_partials/header.njk', 'HEADER')
    write('src/post.njk', '---\ntitle: Post\n---\n{% include "_partials/header.njk" %} body')
    await build()

    const index = readIndex()
    expect(index['src/post.njk']).toBeDefined()
    expect(index['src/_partials/header.njk']).toBeUndefined()
  })

  it('drops the entry of a page that no longer exists', async() => {
    write('src/one.md', '---\ntitle: One\n---\none')
    write('src/gone.md', '---\ntitle: Gone\n---\ngone')
    await build()
    expect(readIndex()['src/gone.md']).toBeDefined()

    fs.rmSync(path.join(TMP, 'src', 'gone.md'))
    clearFrontMatterCache()
    await build()

    expect(readIndex()['src/gone.md']).toBeUndefined()
    expect(readIndex()['src/one.md']).toBeDefined()
  })

  it('restamps everything rather than failing when the index file is unreadable', async() => {
    fs.writeFileSync(INDEX, '{ this is not json')
    write('src/post.md', '---\ntitle: Post\n---\nbody')

    await build()

    expect(readIndex()['src/post.md'].updated).toBe(EDITED.toISOString())
  })

  it('writes posix keys in sorted order, so two branches editing different pages meet in different lines', async() => {
    write('src/blog/b.md', '---\ntitle: B\n---\nb')
    write('src/blog/a.md', '---\ntitle: A\n---\na')
    write('src/index.md', '---\ntitle: Home\n---\nhome')
    await build()

    expect(Object.keys(readIndex())).toEqual(['src/blog/a.md', 'src/blog/b.md', 'src/index.md'])
  })

  it('writes no index and stamps no date while lastUpdated is off', async() => {
    write('src/post.njk', '---\ntitle: Post\n---\nedited [{{ page.updated }}]')
    await new Markups({ markup: { in: 'src', out: 'dist', options: {} } }).compile()

    expect(fs.existsSync(INDEX)).toBe(false)
    expect(readOut('post.html')).toContain('edited []')
  })

  it('writes the index where lastUpdated names it', async() => {
    write('src/post.md', '---\ntitle: Post\n---\nbody')
    await build({ lastUpdated: 'meta/updates.json' })

    expect(fs.existsSync(path.join(TMP, 'meta', 'updates.json'))).toBe(true)
    expect(fs.existsSync(INDEX)).toBe(false)
  })
})
