import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSingleCollectionData } from '../collections.js'

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
