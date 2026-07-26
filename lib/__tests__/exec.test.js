import { it, describe, expect, jest } from '@jest/globals'
import runExec from '../exec.js'

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
})
