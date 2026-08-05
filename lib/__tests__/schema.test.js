// Covers: schema/poops.schema.json being a valid JSON Schema, describing the
// config the code actually accepts — the top-level keys poops.js validates
// against, the exec stages exec.js fires, the markup options markups.js reads —
// and accepting the configs this repo ships: its own poops.json, and every
// complete example in README.md and the documentation site.
//
// Deliberately not covered: the per-entry `options` of scripts, styles, postcss
// and reactor. Most are esbuild's or PostCSS's, not Poops', so there is no local
// list to compare a description against — a wrong *type* on one is caught by the
// document checks below, an entirely missing one is not.

import { it, describe, expect } from '@jest/globals'
import { KNOWN_CONFIG_KEYS } from '../utils/helpers.js'
import { EXEC_STAGES } from '../exec.js'
import Ajv from 'ajv'
import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
const SCHEMA_PATH = path.join(ROOT, 'schema', 'poops.schema.json')
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'))

// strict:false — the schema is written for editors, which accept `examples` and
// long descriptions ajv's strict mode would flag as unknown or redundant.
const ajv = new Ajv({ allErrors: true, strict: false })

// A documentation example is a fragment by design: a block showing `feed` shows
// the one `markup.options` key, not the `in`/`out` around it. Dropping `required`
// lets those be checked for what a doc example can still get wrong — a misspelt
// key, a value of the wrong type — without demanding a whole config.
function withoutRequired(node) {
  if (Array.isArray(node)) return node.map(withoutRequired)
  if (!node || typeof node !== 'object') return node
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== 'required')
      .map(([key, value]) => [key, withoutRequired(value)])
  )
}

// Every fenced ```json block in the docs whose first key is one Poops owns.
// Blocks carrying a fence marker (```json file=package.json) are somebody
// else's file and are skipped; a block that is not parseable JSON is prose
// about JSON (a `//` comment, an ellipsis) and is skipped too.
function configExamples(file) {
  // Normalised on read: on Windows the checkout has CRLF, and the fence pattern
  // below only survives it by accident — `[^\n]*` swallows the `\r` into the
  // info string, where `.trim()` clears it. Do not rely on that.
  const source = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')
  const found = []
  for (const match of source.matchAll(/```json([^\n]*)\n([\s\S]*?)```/g)) {
    if (match[1].trim()) continue
    let doc
    try { doc = JSON.parse(match[2]) } catch { continue }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) continue
    if (!Object.keys(doc).some((key) => KNOWN_CONFIG_KEYS.has(key))) continue
    found.push({ file: path.relative(ROOT, file), line: source.slice(0, match.index).split('\n').length, doc })
  }
  return found
}

const DOC_FILES = [
  path.join(ROOT, 'README.md'),
  ...globSync('example/src/markup/**/*.md', { cwd: ROOT, absolute: true, posix: true })
]

describe('the published schema', () => {
  it('is itself a valid JSON Schema', () => {
    // Catches what a key-set comparison cannot: a misspelt type, a malformed
    // enum, a keyword given the wrong shape.
    expect(ajv.validateSchema(schema)).toBe(true)
  })

  // Not the meta-schema's job — draft-07 permits the sibling, it just discards
  // it, so a description written there is legal and invisible.
  it('leaves no description beside a $ref, where draft-07 would discard it', () => {
    const orphaned = []
    const walk = (node, at) => {
      if (Array.isArray(node)) return node.forEach((item, i) => walk(item, `${at}/${i}`))
      if (!node || typeof node !== 'object') return
      if (node.$ref && Object.keys(node).length > 1) orphaned.push(at)
      Object.entries(node).forEach(([key, value]) => walk(value, `${at}/${key}`))
    }
    walk(schema, '')
    expect(orphaned).toEqual([])
  })

  it('accepts the config this repo builds itself with', () => {
    const validate = ajv.compile(schema)
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'poops.json'), 'utf-8'))
    expect(validate(config) ? [] : validate.errors).toEqual([])
  })

  it('accepts every config example in the README and the documentation site', () => {
    // $id dropped with it: ajv keys its cache by $id, and the strict schema is
    // already registered under this one.
    const { $id, ...relaxed } = withoutRequired(schema)
    const validate = ajv.compile(relaxed)
    const examples = DOC_FILES.flatMap(configExamples)

    // The crawler silently finding nothing would pass this test while checking
    // nothing at all. The count only has to be a floor, not exact.
    expect(examples.length).toBeGreaterThan(50)

    const rejected = examples.flatMap(({ file, line, doc }) =>
      validate(doc) ? [] : [`${file}:${line} — ${ajv.errorsText(validate.errors)}`]
    )
    expect(rejected).toEqual([])
  })

  it('describes every top-level key the CLI accepts, and no key it would reject', () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...KNOWN_CONFIG_KEYS].sort())
  })

  it('rejects a misspelt Poops key, while leaving room for a companion block', () => {
    // The CLI accepts an unknown key that names an installed dependency, and
    // nothing in a schema can see node_modules — so the root stays open to
    // objects and closed to everything else. `"stlyes": [...]` is still caught.
    const validate = ajv.compile(schema)
    expect(validate({ stlyes: [{ in: 'a.scss', out: 'b.css' }] })).toBe(false)
    expect(validate({ septic: { db: 'data/app.db' } })).toBe(true)
  })

  it('lists every exec stage that actually fires, and no stage that never would', () => {
    expect(Object.keys(schema.definitions.exec.properties).sort()).toEqual([...EXEC_STAGES].sort())
    expect(schema.definitions.exec.additionalProperties).toBe(false)
  })

  it('describes every markup option the engine reads', () => {
    // Read off markups.js rather than an exported list — the options are read
    // one at a time, into differently named fields, so the call site is the
    // only place they all appear. An option reached some other way slips past
    // this, but nothing here can fail for a wrong reason.
    const source = fs.readFileSync(path.join(__dirname, '..', 'markups.js'), 'utf-8')
    const read = [...source.matchAll(/(?:this\.option|deprecatedOption)\('([^']+)'/g)].map((m) => m[1])
    expect(read.length).toBeGreaterThan(0)

    const described = Object.keys(schema.definitions.markupOptions.properties)
    expect([...new Set(read)].filter((key) => !described.includes(key))).toEqual([])
  })

  it('has no $ref pointing at a definition that does not exist', () => {
    const refs = new Set()
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node !== 'object') return
      if (typeof node.$ref === 'string') refs.add(node.$ref)
      Object.values(node).forEach(walk)
    }
    walk(schema)

    const dangling = [...refs].filter((ref) => {
      const name = ref.replace('#/definitions/', '')
      return !ref.startsWith('#/definitions/') || !(name in schema.definitions)
    })
    expect(dangling).toEqual([])
  })

  it('has no definition nothing points at', () => {
    const refs = new Set()
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node !== 'object') return
      if (typeof node.$ref === 'string') refs.add(node.$ref.replace('#/definitions/', ''))
      Object.values(node).forEach(walk)
    }
    walk(schema)

    expect(Object.keys(schema.definitions).filter((name) => !refs.has(name))).toEqual([])
  })
})
