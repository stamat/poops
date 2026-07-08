import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Scripts from '../scripts.js'

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

  it('logs an error when a glob pattern matches nothing', async() => {
    await new Scripts({
      scripts: { in: 'src/*.ts', out: 'dist/js' },
      includePaths: []
    }).compile()

    const missing = errorSpy.mock.calls.filter(args => String(args[0]).includes('does not exist'))
    expect(missing).toHaveLength(1)
  })
})
