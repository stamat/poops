import { it, describe, expect, jest } from '@jest/globals'
import runExec, { validateExec, EXEC_STAGES, EXEC_KEYS } from '../exec.js'

// Silence the styledLog/log output the hook prints per command.
jest.spyOn(console, 'log').mockImplementation(() => {})
jest.spyOn(console, 'error').mockImplementation(() => {})

describe('runExec', () => {
  it('no-ops when config.exec is absent', () => {
    const run = jest.fn()
    expect(runExec({}, '/proj', 'styles', run)).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it('no-ops when the stage has no hook', () => {
    const run = jest.fn()
    expect(runExec({ exec: { build: 'x' } }, '/proj', 'styles', run)).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it('runs a single string command from cwd', () => {
    const run = jest.fn()
    expect(runExec({ exec: { styles: 'echo hi' } }, '/proj', 'styles', run)).toBe(false)
    expect(run).toHaveBeenCalledWith('echo hi', { cwd: '/proj', stdio: 'inherit' })
  })

  it('runs an array of commands in order', () => {
    const run = jest.fn()
    runExec({ exec: { styles: ['a', 'b', 'c'] } }, '/proj', 'styles', run)
    expect(run.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c'])
  })

  it('returns true on failure but keeps running the rest', () => {
    const run = jest.fn((cmd) => { if (cmd === 'b') throw new Error('boom') })
    expect(runExec({ exec: { styles: ['a', 'b', 'c'] } }, '/proj', 'styles', run)).toBe(true)
    expect(run.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']) // c still ran
  })

  it('a bare stage key never fires for that stage\'s pre hook', () => {
    const run = jest.fn()
    expect(runExec({ exec: { markup: 'after' } }, '/proj', 'pre:markup', run)).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it('a pre: key fires only before its stage, never after it', () => {
    const run = jest.fn()
    runExec({ exec: { 'pre:markup': 'before' } }, '/proj', 'pre:markup', run)
    expect(run.mock.calls.map((c) => c[0])).toEqual(['before'])
    run.mockClear()
    expect(runExec({ exec: { 'pre:markup': 'before' } }, '/proj', 'markup', run)).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it('post: is the explicit spelling of a bare stage key', () => {
    const run = jest.fn()
    runExec({ exec: { 'post:markup': 'after' } }, '/proj', 'markup', run)
    expect(run.mock.calls.map((c) => c[0])).toEqual(['after'])
  })

  it('a config carrying both spellings of one hook drops neither, bare first', () => {
    const run = jest.fn()
    runExec({ exec: { markup: 'bare', 'post:markup': ['x', 'y'] } }, '/proj', 'markup', run)
    expect(run.mock.calls.map((c) => c[0])).toEqual(['bare', 'x', 'y'])
  })
})

describe('validateExec', () => {
  it('flags an unknown stage key', () => {
    expect(validateExec({ exec: { style: 'x', build: 'y' } })).toEqual(['style'])
  })

  it('flags a typo behind a valid prefix', () => {
    expect(validateExec({ exec: { 'pre:style': 'x', 'pre:styles': 'y' } })).toEqual(['pre:style'])
  })

  it('flags a prefix that is not one of the two', () => {
    expect(validateExec({ exec: { 'after:markup': 'x' } })).toEqual(['after:markup'])
  })

  it('returns empty when every key is a real stage', () => {
    expect(validateExec({ exec: Object.fromEntries(EXEC_STAGES.map((s) => [s, 'x'])) })).toEqual([])
  })

  it('returns empty for every prefixed spelling of every stage', () => {
    expect(validateExec({ exec: Object.fromEntries(EXEC_KEYS.map((k) => [k, 'x'])) })).toEqual([])
  })

  it('returns empty when config.exec is absent', () => {
    expect(validateExec({})).toEqual([])
  })
})
