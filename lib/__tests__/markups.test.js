import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Markups from '../markups.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, '_tmp-markups')

// removeOutput maps paths relative to process.cwd(), so tests run from TMP
const originalCwd = process.cwd()

function makeMarkups(markupIn, markupOut) {
  return new Markups({ markup: { in: markupIn, out: markupOut } })
}

beforeEach(() => {
  fs.mkdirSync(path.join(TMP, 'src', 'blog'), { recursive: true })
  fs.mkdirSync(path.join(TMP, 'dist', 'blog'), { recursive: true })
  process.chdir(TMP)
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('removeOutput', () => {
  it('removes the mapped output file with extension replaced', () => {
    fs.writeFileSync(path.join(TMP, 'dist', 'blog', 'post.html'), 'x')
    makeMarkups('src', 'dist').removeOutput(path.join('src', 'blog', 'post.md'))
    expect(fs.existsSync(path.join(TMP, 'dist', 'blog', 'post.html'))).toBe(false)
  })

  it('removes a mirrored output directory recursively', () => {
    fs.writeFileSync(path.join(TMP, 'dist', 'blog', 'post.html'), 'x')
    makeMarkups('src', 'dist').removeOutput(path.join('src', 'blog'))
    expect(fs.existsSync(path.join(TMP, 'dist', 'blog'))).toBe(false)
  })

  it('ignores paths outside the markup input dir', () => {
    fs.writeFileSync(path.join(TMP, 'dist', 'blog', 'post.html'), 'x')
    makeMarkups('src', 'dist').removeOutput(path.join('elsewhere', 'blog', 'post.md'))
    expect(fs.existsSync(path.join(TMP, 'dist', 'blog', 'post.html'))).toBe(true)
  })

  it('never removes the whole output dir when the markup input dir itself is deleted', () => {
    fs.writeFileSync(path.join(TMP, 'dist', 'app.js'), 'x')
    makeMarkups('src', 'dist').removeOutput('src')
    expect(fs.existsSync(path.join(TMP, 'dist'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'app.js'))).toBe(true)
  })

  it('handles single-file markup config', () => {
    fs.writeFileSync(path.join(TMP, 'src', 'index.md'), 'x')
    fs.writeFileSync(path.join(TMP, 'dist', 'index.html'), 'x')
    makeMarkups(path.join('src', 'index.md'), path.join('dist', 'index.md')).removeOutput(path.join('src', 'index.md'))
    expect(fs.existsSync(path.join(TMP, 'dist', 'index.html'))).toBe(false)
  })

  it('is a no-op when the output does not exist', () => {
    expect(() => makeMarkups('src', 'dist').removeOutput(path.join('src', 'missing.md'))).not.toThrow()
  })
})

describe('data file globals', () => {
  it('drops the global when a data file is deleted', () => {
    fs.mkdirSync(path.join(TMP, 'src', '_data'), { recursive: true })
    fs.writeFileSync(path.join(TMP, 'src', '_data', 'nav.yml'), 'title: hi')

    const m = new Markups({ markup: { in: 'src', out: 'dist', data: ['_data'] } })
    expect(m.engine.env.globals.nav).toEqual({ title: 'hi' })

    fs.unlinkSync(path.join(TMP, 'src', '_data', 'nav.yml'))
    return m.reloadDataFiles().then(() => {
      expect(m.engine.env.globals.nav).toBeUndefined()
    })
  })
})

describe('reactor globals', () => {
  it('drops the injected global when a reactor component is removed', async() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    fs.writeFileSync(path.join(TMP, 'src', 'index.html'), '<p>hi</p>')

    const config = { markup: { in: 'src', out: 'dist' }, reactorData: { widget: '<b>x</b>' } }
    const m = new Markups(config)

    await m.compile()
    expect(m.engine.env.globals.widget).toBe('<b>x</b>')

    // component deleted → its key disappears from reactorData
    config.reactorData = {}
    await m.compile()
    expect(m.engine.env.globals.widget).toBeUndefined()
    jest.restoreAllMocks()
  })
})
