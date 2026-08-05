// Covers: which poops.json keys the CLI accepts in silence — the known
// top-level set, a companion package's own block, and below the top level the
// keys the published schema says Poops owns. poops.json is shared, so septic
// reads a `septic` key out of the same file; warning about it on every build
// would be noise about something working as designed.
//
// The CLI does the top-level check at module scope, so it is exercised by
// running the binary rather than importing it. Deliberately not covered: that
// Poops leaves the companion's block alone once accepted — nothing reads it, so
// there is no behaviour to assert; and types — `unknownConfigKeys` reads key
// names only, so `"watch": "yes"` is nobody's finding here.

import { afterAll, beforeAll, it, describe, expect } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import { projectPackageNames, unknownConfigKeys } from '../utils/helpers.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
const TMP = path.join(__dirname, '_tmp-config-keys')
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'poops.schema.json'), 'utf-8'))
const unknownIn = (config) => unknownConfigKeys(config, schema).map(({ at, key }) => `${at}.${key}`)

const write = (file, data) =>
  fs.writeFileSync(path.join(TMP, file), typeof data === 'string' ? data : JSON.stringify(data))

// -q so only warnings and build output land in the capture, never the header.
const runPoops = () =>
  execFileSync('node', [path.join(ROOT, 'poops.js'), '-b', '-q'], { cwd: TMP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

beforeAll(() => {
  fs.mkdirSync(path.join(TMP, 'src'), { recursive: true })
  write('src/index.scss', '.a { color: red; }')
})

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }))

const STYLES = [{ in: 'src/index.scss', out: 'dist/app.css' }]

describe('unknown top-level config keys', () => {
  it('names a misspelt key as unknown rather than ignoring it in silence', () => {
    write('package.json', { name: 'fixture', version: '1.0.0' })
    write('poops.json', { styles: STYLES, stlyes: [] })
    expect(runPoops()).toContain('Unknown config key "stlyes"')
  })

  it('says nothing about a key that names a package the project depends on', () => {
    write('package.json', { name: 'fixture', version: '1.0.0', dependencies: { septic: '^0.1.0' } })
    write('poops.json', { styles: STYLES, septic: { db: 'data/app.db' } })
    expect(runPoops()).not.toContain('septic')
  })

  it('warns about that same key when nothing by that name is depended on', () => {
    write('package.json', { name: 'fixture', version: '1.0.0' })
    write('poops.json', { styles: STYLES, septic: { db: 'data/app.db' } })
    expect(runPoops()).toContain('Unknown config key "septic"')
  })

  it('still names the replacement for a 1.x key, installed or not', () => {
    write('package.json', { name: 'fixture', version: '1.0.0', dependencies: { ssg: '^1.0.0' } })
    write('poops.json', { styles: STYLES, ssg: {} })
    expect(runPoops()).toContain('renamed to "reactor" in 2.0')
  })
})

describe('unknown keys below the top level', () => {
  it('names a misspelt key in a styles entry, which otherwise compiles nothing and still exits 0', () => {
    expect(unknownIn({ styles: [{ inn: 'src/a.scss', out: 'dist/a.css' }] })).toEqual(['styles[0].inn'])
  })

  it('reads a lone entry object the same as an array of one, since both are accepted', () => {
    expect(unknownIn({ styles: { inn: 'src/a.scss', out: 'dist/a.css' } })).toEqual(['styles.inn'])
  })

  it('reaches a markup option, the deepest place a typo is read by nothing', () => {
    expect(unknownIn({ markup: { in: 'src', out: 'dist', options: { engnie: 'liquid' } } })).toEqual(['markup.options.engnie'])
  })

  it('offers the keys that block does accept, so the warning names the fix', () => {
    expect(unknownConfigKeys({ copy: [{ inn: 'src/img' }] }, schema)[0].valid).toEqual(['in', 'out'])
  })

  it('says nothing about the images block, whose keys belong to poops-images', () => {
    expect(unknownIn({ images: { in: 'src/img', out: 'dist/img', handlers: './h.js' } })).toEqual([])
  })

  it('says nothing about site metadata, which is the template author\'s to name', () => {
    expect(unknownIn({ markup: { options: { site: { twitter: '@stamat' } } } })).toEqual([])
  })

  it('leaves a companion block alone, the top-level check having already ruled on it', () => {
    expect(unknownIn({ septic: { db: 'data/app.db' } })).toEqual([])
  })

  it('leaves exec to validateExec, which says the more useful thing — that the stage never runs', () => {
    expect(unknownIn({ exec: { stlyes: 'echo hi' } })).toEqual([])
  })

  it('finds nothing in the config this repo builds itself with', () => {
    expect(unknownIn(JSON.parse(fs.readFileSync(path.join(ROOT, 'poops.json'), 'utf-8')))).toEqual([])
  })

  it('is silent rather than wrong when the schema is missing, so a stripped install still builds', () => {
    expect(unknownConfigKeys({ styles: [{ inn: 'a.scss' }] }, null)).toEqual([])
  })

  it('warns from the CLI, not only in this test', () => {
    write('package.json', { name: 'fixture', version: '1.0.0' })
    write('poops.json', { styles: [{ inn: 'src/index.scss', out: 'dist/app.css' }] })
    expect(runPoops()).toContain('Unknown key "inn" in styles[0]')
  })
})

describe('projectPackageNames', () => {
  it('collects all four dependency fields', () => {
    write('package.json', {
      name: 'fixture',
      dependencies: { a: '1' },
      devDependencies: { b: '1' },
      peerDependencies: { c: '1' },
      optionalDependencies: { d: '1' }
    })
    expect([...projectPackageNames(TMP)].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('is empty for a project with no package.json, so every unknown key warns again', () => {
    expect(projectPackageNames(path.join(TMP, 'src'))).toEqual(new Set())
  })

  it('is empty for a package.json that cannot be parsed, rather than taking the build down', () => {
    write('package.json', '{ not json')
    expect(projectPackageNames(TMP)).toEqual(new Set())
  })
})
