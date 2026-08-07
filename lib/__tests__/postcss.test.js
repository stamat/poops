import { it, describe, expect, beforeEach, afterAll, jest } from '@jest/globals'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import PostCSS from '../postcss.js'

// Covers what the PostCSS runner writes beside its output: the composed source
// map, and the banner line every mapping has to shift past. Plugin resolution
// by name is deliberately not covered — it is `import()` and nothing else, and
// a test for it would only assert that Node can load a package.

jest.spyOn(console, 'log').mockImplementation(() => {})
jest.spyOn(console, 'error').mockImplementation(() => {})

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'poops-postcss-'))
const infile = path.join(tmp, 'in.css')
const outfile = path.join(tmp, 'out.css')

// A plugin that drops comments, so the pass moves the lines the map describes.
const stripComments = {
  postcssPlugin: 'test-strip-comments',
  OnceExit: (root) => root.walkComments((comment) => comment.remove())
}

const SOURCE = '/* dropped */\n.a {\n  color: red;\n}\n'
const PREV_MAP = {
  version: 3,
  file: 'in.css',
  sources: ['a.scss'],
  names: [],
  mappings: ';AAAA;EACE'
}

beforeEach(() => {
  fs.rmSync(outfile, { force: true })
  fs.rmSync(`${outfile}.map`, { force: true })
  fs.writeFileSync(infile, SOURCE)
})

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

// Through `compile()`, not `compileEntry()` — the postcss import is lazy and
// only `compile()` performs it.
function run(config, options = { plugins: [stripComments] }) {
  return new PostCSS({ ...config, postcss: [{ in: infile, out: outfile, options }] }).compile()
}

describe('PostCSS source maps', () => {
  it('writes the map when the input carries one, so it describes the lines this pass moved', async() => {
    fs.appendFileSync(infile, '/*# sourceMappingURL=in.css.map */')
    fs.writeFileSync(`${infile}.map`, JSON.stringify(PREV_MAP))

    await run({})

    const map = JSON.parse(fs.readFileSync(`${outfile}.map`, 'utf-8'))
    expect(map.sources.some((source) => source.endsWith('a.scss'))).toBe(true)
    expect(fs.readFileSync(outfile, 'utf-8')).toContain('sourceMappingURL=out.css.map')
  })

  it('shifts every mapping past the banner line the runner prepends', async() => {
    fs.appendFileSync(infile, '/*# sourceMappingURL=in.css.map */')
    fs.writeFileSync(`${infile}.map`, JSON.stringify(PREV_MAP))

    await run({ banner: '/* banner */' })

    const map = JSON.parse(fs.readFileSync(`${outfile}.map`, 'utf-8'))
    expect(map.mappings.startsWith(';')).toBe(true)
    expect(fs.readFileSync(outfile, 'utf-8').split('\n')[0]).toBe('/* banner */')
  })

  it('writes no map when the input has none, rather than an empty one', async() => {
    await run({})

    expect(fs.existsSync(outfile)).toBe(true)
    expect(fs.existsSync(`${outfile}.map`)).toBe(false)
  })
})
