import { it, describe, expect, beforeAll, afterAll } from '@jest/globals'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import NunjucksEngine from '../engines/nunjucks.js'
import LiquidEngine from '../engines/liquid.js'

// Package templates: {% extends 'pkg/layout.html' %} resolves from the
// consumer project's node_modules. Fixture is built in a temp project at
// runtime because node_modules can't be committed (.gitignore excludes it).
let root, engine

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'poops-pkg-'))
  const src = path.join(root, 'src')
  const pkg = path.join(root, 'node_modules', 'poops-fake-theme')
  fs.mkdirSync(src, { recursive: true })
  fs.mkdirSync(pkg, { recursive: true })

  // No `exports` field → bare-subpath resolution of the .html files is allowed.
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'poops-fake-theme', version: '1.0.0' }))
  // Layout self-references its partial relatively ('./') — proves the free win:
  // the loader's resolve() anchors the relative name to the package path.
  fs.writeFileSync(path.join(pkg, 'layout.html'),
    '{% import "./partial.html" as p %}<main>{% block content %}{% endblock %} {{ p.badge() }}</main>')
  fs.writeFileSync(path.join(pkg, 'partial.html'),
    '{% macro badge() %}[from-package]{% endmacro %}')

  engine = new NunjucksEngine(src, [], {})
})

afterAll(() => { fs.rmSync(root, { recursive: true, force: true }) })

describe('package template resolution', () => {
  it('resolves {% extends "pkg/layout.html" %} from node_modules', async() => {
    const out = await engine.renderString(
      '{% extends "poops-fake-theme/layout.html" %}{% block content %}PAGE{% endblock %}', {})
    expect(out).toContain('<main>PAGE')
  })

  it('resolves a package template\'s own relative includes', async() => {
    const out = await engine.renderString(
      '{% extends "poops-fake-theme/layout.html" %}{% block content %}X{% endblock %}', {})
    expect(out).toContain('[from-package]')
  })

  it('does not module-resolve bare local names (the "/" gate)', async() => {
    // A missing bare include must fail as not-found, never attempt (and mask
    // errors from) node_modules resolution. getSource returns empty src, so
    // the render succeeds with the include contributing nothing.
    const out = await engine.renderString('before{% include "does-not-exist.html" %}after', {})
    expect(out).toBe('beforeafter')
  })
})

// Liquid parity: node_modules is on the include roots, so package layouts and
// partials resolve the same way — without weakening liquidjs's containment guard.
let lqRoot, lqEngine

beforeAll(() => {
  lqRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'poops-pkg-lq-'))
  const src = path.join(lqRoot, 'src')
  const pkg = path.join(lqRoot, 'node_modules', 'poops-fake-theme')
  fs.mkdirSync(src, { recursive: true })
  fs.mkdirSync(pkg, { recursive: true })

  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'poops-fake-theme', version: '1.0.0' }))
  // Layout self-references its partial relatively — currentFile is the layout's
  // resolved node_modules path, so './badge.liquid' resolves beside it.
  fs.writeFileSync(path.join(pkg, 'layout.liquid'),
    '<main>{% block content %}{% endblock %} {% render \'./badge.liquid\' %}</main>')
  fs.writeFileSync(path.join(pkg, 'badge.liquid'), '[from-package]')
  // A project partial that must still win over node_modules (roots order).
  fs.writeFileSync(path.join(src, 'local.liquid'), 'LOCAL')

  lqEngine = new LiquidEngine(src, [])
})

afterAll(() => { fs.rmSync(lqRoot, { recursive: true, force: true }) })

describe('Liquid package template resolution', () => {
  it('resolves {% layout "pkg/layout.liquid" %} from node_modules', async() => {
    const out = await lqEngine.renderString(
      '{% layout \'poops-fake-theme/layout.liquid\' %}{% block content %}PAGE{% endblock %}', {})
    expect(out).toContain('<main>PAGE')
  })

  it('resolves a package template\'s own relative includes', async() => {
    const out = await lqEngine.renderString(
      '{% layout \'poops-fake-theme/layout.liquid\' %}{% block content %}X{% endblock %}', {})
    expect(out).toContain('[from-package]')
  })

  it('keeps project templates resolving (node_modules roots are appended last)', async() => {
    const out = await lqEngine.renderString('{% render \'local.liquid\' %}', {})
    expect(out).toBe('LOCAL')
  })
})
