import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Scripts from '../scripts.js'
import Styles from '../styles.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, '_tmp-glob-entries')

// Modules resolve entries relative to process.cwd()
const originalCwd = process.cwd()
let errorSpy

beforeEach(() => {
  fs.mkdirSync(path.join(TMP, 'src'), { recursive: true })
  process.chdir(TMP)
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  process.chdir(originalCwd)
  fs.rmSync(TMP, { recursive: true, force: true })
})

describe('glob script entries', () => {
  it('compiles every file matched by a glob pattern', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'a.js'), 'export const a = 1\n')
    fs.writeFileSync(path.join(TMP, 'src', 'b.js'), 'export const b = 2\n')

    await new Scripts({
      scripts: { in: 'src/*.js', out: 'dist/js', options: { format: 'esm' } },
      includePaths: []
    }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'js', 'a.js'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'js', 'b.js'))).toBe(true)
  })

  it('compiles TypeScript matched by a glob to plain JS', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'typed.ts'), 'export const n: number = 1\nexport interface Spell { name: string }\n')

    await new Scripts({
      scripts: { in: 'src/*.ts', out: 'dist/js', options: { format: 'esm', bundle: false } },
      includePaths: []
    }).compile()

    const out = fs.readFileSync(path.join(TMP, 'dist', 'js', 'typed.js'), 'utf8')
    expect(out).toContain('const n = 1')
    expect(out).not.toContain('number')
    expect(out).not.toContain('interface')
  })

  it('logs an error when a glob pattern matches nothing', async() => {
    await new Scripts({
      scripts: { in: 'src/*.ts', out: 'dist/js' },
      includePaths: []
    }).compile()

    const missing = errorSpy.mock.calls.filter(args => String(args[0]).includes('does not exist'))
    expect(missing).toHaveLength(1)
  })
})

describe('glob style entries', () => {
  it('compiles every file matched by a glob, skipping sass partials', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'a.scss'), 'body { color: red; }\n')
    fs.writeFileSync(path.join(TMP, 'src', 'b.scss'), 'h1 { color: blue; }\n')
    fs.writeFileSync(path.join(TMP, 'src', '_vars.scss'), '$x: 1;\n')

    await new Styles({ styles: { in: 'src/*.scss', out: 'dist/css/' } }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'css', 'a.css'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'css', 'b.css'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'css', '_vars.css'))).toBe(false)
  })

  it('compiles an array of entry points', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'a.scss'), 'body { color: red; }\n')
    fs.writeFileSync(path.join(TMP, 'src', 'b.scss'), 'h1 { color: blue; }\n')

    await new Styles({ styles: { in: ['src/a.scss', 'src/b.scss'], out: 'dist/css/' } }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'css', 'a.css'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'css', 'b.css'))).toBe(true)
  })

  it('logs an error when a glob pattern matches nothing', async() => {
    await new Styles({ styles: { in: 'src/*.scss', out: 'dist/css/' } }).compile()

    const missing = errorSpy.mock.calls.filter(args => String(args[0]).includes('does not exist'))
    expect(missing).toHaveLength(1)
  })

  it('exits when multiple inputs target a single output file', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'a.scss'), 'body { color: red; }\n')
    fs.writeFileSync(path.join(TMP, 'src', 'b.scss'), 'h1 { color: blue; }\n')

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(
      new Styles({ styles: { in: 'src/*.scss', out: 'dist/css/main.css' } }).compile()
    ).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('still compiles a single input to a single output file', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'a.scss'), 'body { color: red; }\n')

    await new Styles({ styles: { in: 'src/a.scss', out: 'dist/css/main.css' } }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'css', 'main.css'))).toBe(true)
  })
})

describe('index entry points', () => {
  beforeEach(() => {
    for (const name of ['accordion', 'tabs']) {
      fs.mkdirSync(path.join(TMP, 'src', 'elements', name), { recursive: true })
      fs.writeFileSync(path.join(TMP, 'src', 'elements', name, 'index.js'), `export const ${name} = 1\n`)
      fs.writeFileSync(path.join(TMP, 'src', 'elements', name, 'index.scss'), `.${name} { color: red; }\n`)
    }
  })

  it('names script output after the directory of an index entry', async() => {
    await new Scripts({
      scripts: { in: 'src/elements/*/index.{js,mjs,cjs,jsx}', out: 'dist/', options: { format: 'esm' } },
      includePaths: []
    }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'accordion.js'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'tabs.js'))).toBe(true)
  })

  it('names style output after the directory of an index entry', async() => {
    await new Styles({ styles: { in: 'src/elements/*/index.{scss,sass,css}', out: 'dist/' } }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'accordion.css'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'tabs.css'))).toBe(true)
  })

  it('resolves a brace pattern without a wildcard as a glob', async() => {
    await new Styles({ styles: { in: 'src/elements/accordion/index.{scss,sass,css}', out: 'dist/' } }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'accordion.css'))).toBe(true)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('keeps the basename of a literal index entry', async() => {
    await new Scripts({
      scripts: { in: 'src/elements/accordion/index.js', out: 'dist/', options: { format: 'esm' } },
      includePaths: []
    }).compile()
    await new Styles({ styles: { in: 'src/elements/accordion/index.scss', out: 'dist/' } }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'index.css'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'accordion.js'))).toBe(false)
    expect(fs.existsSync(path.join(TMP, 'dist', 'accordion.css'))).toBe(false)
  })

  it('honours an explicit outfile for a glob-matched index entry', async() => {
    await new Scripts({
      scripts: { in: 'src/elements/accordion/index.{js,jsx}', out: 'dist/bundle.js', options: { format: 'esm' } },
      includePaths: []
    }).compile()

    expect(fs.existsSync(path.join(TMP, 'dist', 'bundle.js'))).toBe(true)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('nests same-named directories under the glob static prefix', async() => {
    for (const group of ['blocks', 'elements']) {
      fs.mkdirSync(path.join(TMP, 'src', group, 'accordion'), { recursive: true })
      fs.writeFileSync(path.join(TMP, 'src', group, 'accordion', 'index.js'), `export const ${group} = 1\n`)
      fs.writeFileSync(path.join(TMP, 'src', group, 'accordion', 'index.scss'), `.${group} { color: red; }\n`)
    }

    await new Scripts({
      scripts: { in: 'src/*/accordion/index.js', out: 'dist/', options: { format: 'esm' } },
      includePaths: []
    }).compile()
    await new Styles({ styles: { in: 'src/*/accordion/index.scss', out: 'dist/' } }).compile()

    // Static prefix is `src`, so the differing segment is kept — no collision
    expect(fs.existsSync(path.join(TMP, 'dist', 'blocks', 'accordion.js'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'elements', 'accordion.js'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'blocks', 'accordion.css'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'elements', 'accordion.css'))).toBe(true)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('flattens when the glob static prefix already covers the shared path', async() => {
    await new Scripts({
      scripts: { in: 'src/elements/*/index.js', out: 'dist/', options: { format: 'esm' } },
      includePaths: []
    }).compile()

    // Static prefix is `src/elements`, so nothing is left to nest under
    expect(fs.existsSync(path.join(TMP, 'dist', 'accordion.js'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'tabs.js'))).toBe(true)
  })
})
