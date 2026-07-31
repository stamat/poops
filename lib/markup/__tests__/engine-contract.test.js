import { it, describe, expect, beforeAll, afterAll } from '@jest/globals'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import NunjucksEngine from '../engines/nunjucks.js'
import LiquidEngine from '../engines/liquid.js'

// The engine interface is public API from 2.0 on: `markup.options.engine`
// accepts any module implementing it, and poops-shopify ships one. A rename or
// signature change here is a breaking change of Poops, so this test exists to
// fail loudly before one ships. Documented in
// example/src/markup/docs/engine-api.md — change both together, or neither.
//
// Shape only, deliberately: what each member *does* is covered by the engines'
// own tests. This is the wire, not the behaviour.

const REQUIRED_METHODS = [
  'registerFilters',
  'registerTags',
  'setGlobal',
  'removeGlobal',
  'render'
]

const REQUIRED_GETTERS = [
  'markupExtensions',
  'indexableExtensions'
]

// Feature-detected by lib/markups.js with a typeof check — an engine may
// implement any subset. Listed so a rename of one is visible here too.
const OPTIONAL_HOOKS = [
  'invalidate',
  'clearCache',
  'pagesDependingOn',
  'replaceOutExtensions',
  'isMarkupSource'
]

const ENGINES = [
  ['nunjucks', NunjucksEngine],
  ['liquid', LiquidEngine]
]

describe.each(ENGINES)('%s engine implements the contract', (name, EngineClass) => {
  let templatesDir, engine

  beforeAll(() => {
    templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), `poops-${name}-contract-`))
    engine = new EngineClass(templatesDir, [], { autoescape: false })
  })

  afterAll(() => {
    fs.rmSync(templatesDir, { recursive: true, force: true })
  })

  it.each(REQUIRED_METHODS)('has a %s method', (method) => {
    expect(typeof engine[method]).toBe('function')
  })

  it('takes (templatesDir, includePaths, options)', () => {
    expect(EngineClass.length).toBeGreaterThanOrEqual(2)
  })

  it('lists page source extensions as a pipe-separated string, no dots', () => {
    expect(typeof engine.markupExtensions).toBe('string')
    expect(engine.markupExtensions).toMatch(/^[a-z0-9]+(\|[a-z0-9]+)*$/)
  })

  it('lists indexable extensions as a Set of dotted extensions', () => {
    expect(engine.indexableExtensions).toBeInstanceOf(Set)
    expect(engine.indexableExtensions.size).toBeGreaterThan(0)
    for (const ext of engine.indexableExtensions) expect(ext).toMatch(/^\.[a-z0-9]+$/)
  })

  it('registers filters from an options object, not positional arguments', () => {
    expect(() => engine.registerFilters({ dateFormat: 'YYYY-MM-DD', markupOut: templatesDir })).not.toThrow()
  })

  it('registers tags from a getOutputDir function', () => {
    expect(() => engine.registerTags(() => templatesDir)).not.toThrow()
  })

  it('sets and removes globals by key', () => {
    expect(() => engine.setGlobal('contract_probe', { ok: true })).not.toThrow()
    expect(() => engine.removeGlobal('contract_probe')).not.toThrow()
  })

  it('renders to a promise of a string', async() => {
    const page = path.join(templatesDir, 'contract.html')
    fs.writeFileSync(page, 'contract ok')
    await expect(engine.render(page, { page: {} })).resolves.toBe('contract ok')
  })

  it.each(OPTIONAL_HOOKS)('exposes %s as a function or not at all', (hook) => {
    expect(['function', 'undefined']).toContain(typeof engine[hook])
  })
})

// Guards the split itself: every member the pipeline calls is listed above, so
// a new call site added to lib/markups.js without a contract entry shows up.
describe('the contract covers what the pipeline calls', () => {
  it('names every engine member lib/markups.js reaches for', () => {
    const source = fs.readFileSync(new URL('../../markups.js', import.meta.url), 'utf8')
    const called = new Set([...source.matchAll(/\bthis\.engine\.([a-zA-Z]+)/g)].map((m) => m[1]))
    const known = new Set([...REQUIRED_METHODS, ...REQUIRED_GETTERS, ...OPTIONAL_HOOKS])

    expect([...called].filter((member) => !known.has(member))).toEqual([])
  })
})
