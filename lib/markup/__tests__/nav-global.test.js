import { it, describe, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import Markups from '../../markups.js'

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-global-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function rel(p) {
  return path.relative(process.cwd(), p)
}

describe('nav template global', () => {
  it('exposes the current build nav tree as the `nav` global', async() => {
    const src = path.join(tmpDir, 'src')
    const dist = path.join(tmpDir, 'dist')
    fs.mkdirSync(path.join(src, 'docs'), { recursive: true })
    fs.mkdirSync(dist)

    fs.writeFileSync(
      path.join(src, 'index.njk'),
      '---\ntitle: Home\norder: 0\n---\n{% for item in nav %}[{{ item.title }}]{% endfor %}'
    )
    fs.writeFileSync(
      path.join(src, 'docs', 'getting-started.njk'),
      '---\ntitle: Getting Started\n---\nhi'
    )

    const markups = new Markups({
      markup: { in: rel(src), out: rel(dist), options: { nav: 'nav.json' } }
    })
    await markups.compile()

    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf-8')
    // Home (order 0) first, then the virtual humanized Docs section —
    // rendered from THIS build, not a previous nav.json
    expect(html).toContain('[Home][Docs]')
    expect(fs.existsSync(path.join(dist, 'nav.json'))).toBe(true)
  })

  it('respects nav options and skips the global when nav is not configured', async() => {
    const src = path.join(tmpDir, 'src')
    const dist = path.join(tmpDir, 'dist')
    fs.mkdirSync(src, { recursive: true })
    fs.mkdirSync(dist)

    fs.writeFileSync(
      path.join(src, 'index.njk'),
      '---\ntitle: Home\n---\n{% if nav %}HAS_NAV{% else %}NO_NAV{% endif %}'
    )

    const markups = new Markups({
      markup: { in: rel(src), out: rel(dist), options: {} }
    })
    await markups.compile()

    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf-8')
    expect(html).toContain('NO_NAV')
    expect(fs.existsSync(path.join(dist, 'nav.json'))).toBe(false)
  })

  it('applies object-form nav options (home: false) to the global', async() => {
    const src = path.join(tmpDir, 'src')
    const dist = path.join(tmpDir, 'dist')
    fs.mkdirSync(src, { recursive: true })
    fs.mkdirSync(dist)

    fs.writeFileSync(
      path.join(src, 'index.njk'),
      '---\ntitle: Home\n---\n{% for item in nav %}[{{ item.title }}]{% endfor %}'
    )
    fs.writeFileSync(
      path.join(src, 'about.njk'),
      '---\ntitle: About\n---\nhi'
    )

    const markups = new Markups({
      markup: { in: rel(src), out: rel(dist), options: { nav: { output: 'nav.json', home: false } } }
    })
    await markups.compile()

    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf-8')
    expect(html).toContain('[About]')
    expect(html).not.toContain('[Home]')
  })
})
