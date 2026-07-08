import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Styles from '../styles.js'
import Scripts from '../scripts.js'
import PostCSS from '../postcss.js'
import Reactor from '../reactor.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, '_tmp-entry-errors')

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

const loggedMissingEntry = () =>
  errorSpy.mock.calls.some(args => String(args[0]).includes('does not exist'))

describe('missing configured entry logs an error instead of silently skipping', () => {
  it('styles', async() => {
    await new Styles({ styles: { in: 'src/nope.scss', out: 'dist/css' } }).compile()
    expect(loggedMissingEntry()).toBe(true)
  })

  it('scripts', async() => {
    await new Scripts({ scripts: { in: 'src/nope.js', out: 'dist/js' }, includePaths: [] }).compile()
    expect(loggedMissingEntry()).toBe(true)
  })

  it('scripts with an array entry reports each missing entry point', async() => {
    await new Scripts({ scripts: { in: ['src/nope.js', 'src/also-nope.js'], out: 'dist/js' }, includePaths: [] }).compile()
    const missing = errorSpy.mock.calls.filter(args => String(args[0]).includes('does not exist'))
    expect(missing).toHaveLength(2)
  })

  it('postcss', async() => {
    await new PostCSS({ postcss: { in: 'src/nope.css', out: 'dist/css' } }).compile()
    expect(loggedMissingEntry()).toBe(true)
  })

  it('reactor component', async() => {
    await new Reactor({ reactor: { component: 'src/Nope.jsx', inject: 'widget' } }).compile()
    expect(loggedMissingEntry()).toBe(true)
  })
})

describe('scripts array entry compiles when all entry points exist', () => {
  it('previously crashed at the pathExists gate before reaching esbuild', async() => {
    fs.writeFileSync(path.join(TMP, 'src', 'one.js'), 'console.log(1)\n')
    fs.writeFileSync(path.join(TMP, 'src', 'two.js'), 'console.log(2)\n')

    // absolute paths: esbuild's service resolves relative paths against its
    // own cwd, which does not follow process.chdir() under jest
    await new Scripts({
      scripts: { in: [path.join(TMP, 'src', 'one.js'), path.join(TMP, 'src', 'two.js')], out: path.join(TMP, 'dist', 'js') },
      includePaths: []
    }).compile()

    expect(loggedMissingEntry()).toBe(false)
    expect(fs.existsSync(path.join(TMP, 'dist', 'js', 'one.js'))).toBe(true)
    expect(fs.existsSync(path.join(TMP, 'dist', 'js', 'two.js'))).toBe(true)
  })
})
