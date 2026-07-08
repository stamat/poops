import { beforeEach, afterEach, it, describe, expect } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import minifyToFile from '../minify.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, 'fixtures', 'minify', '_tmp')

const OUT = path.join(TMP, 'bundle.js')
const MIN = path.join(TMP, 'bundle.min.js')

beforeEach(() => {
  fs.mkdirSync(TMP, { recursive: true })
  fs.writeFileSync(OUT, 'const answer = 40 + 2;\nconsole.log( answer );\n')
})

afterEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true })
})

describe('minifyToFile', () => {
  it('writes a .min file next to the output, reading code from disk when omitted', async() => {
    await minifyToFile({ outfilePath: OUT, loader: 'js', tag: 'script', options: { minify: true } })
    expect(fs.existsSync(MIN)).toBe(true)
    expect(fs.existsSync(OUT)).toBe(true)
    const min = fs.readFileSync(MIN, 'utf-8')
    expect(min).toContain('console.log(42)')
  })

  it('minifies the passed code and prepends the banner', async() => {
    await minifyToFile({
      outfilePath: OUT,
      loader: 'js',
      code: 'const x = 1 + 1;\nconsole.log( x );\n',
      banner: '/* banner */',
      tag: 'script',
      options: { minify: true }
    })
    const min = fs.readFileSync(MIN, 'utf-8')
    expect(min.startsWith('/* banner */\n')).toBe(true)
    expect(min).toContain('console.log(2)')
  })

  it('removes the unminified file when justMinified is set', async() => {
    await minifyToFile({ outfilePath: OUT, loader: 'js', tag: 'script', options: { minify: true, justMinified: true } })
    expect(fs.existsSync(MIN)).toBe(true)
    expect(fs.existsSync(OUT)).toBe(false)
  })

  it('removes a stale .min file when minify is off', async() => {
    fs.writeFileSync(MIN, 'stale')
    await minifyToFile({ outfilePath: OUT, loader: 'js', tag: 'script', options: {} })
    expect(fs.existsSync(MIN)).toBe(false)
    expect(fs.existsSync(OUT)).toBe(true)
  })

  it('supports the css loader', async() => {
    const cssOut = path.join(TMP, 'style.css')
    fs.writeFileSync(cssOut, 'body {  color: red;  }\n')
    await minifyToFile({ outfilePath: cssOut, loader: 'css', tag: 'style', options: { minify: true } })
    expect(fs.readFileSync(path.join(TMP, 'style.min.css'), 'utf-8')).toContain('body{color:red}')
  })
})
