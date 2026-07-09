import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSingleCollectionData, generateCollectionPaginationPages } from '../collections.js'

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

  it('writes every pagination page when the index compiles', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'posts', 'index.md'), '---\ntitle: Posts\n---\n')
    const compileEntryFn = jest.fn().mockResolvedValue({ result: '<html>page</html>' })

    await Promise.all(generateCollectionPaginationPages(collectionData(), 'src', 'dist', compileEntryFn))

    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', 'index.html'), 'utf-8')).toBe('<html>page</html>')
    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', '2', 'index.html'), 'utf-8')).toBe('<html>page</html>')
    expect(fs.readFileSync(path.join(TMP, 'dist', 'posts', '3', 'index.html'), 'utf-8')).toBe('<html>page</html>')
  })
})
