import { afterEach, beforeEach, it, describe, expect, jest } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Markups from '../../markups.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, '_tmp-incremental')

const originalCwd = process.cwd()

function makeMarkups(options = {}) {
  return new Markups({ markup: { in: 'src', out: 'dist', options } })
}

beforeEach(() => {
  fs.mkdirSync(path.join(TMP, 'src', '_partials'), { recursive: true })
  fs.mkdirSync(path.join(TMP, 'dist'), { recursive: true })
  process.chdir(TMP)
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(TMP, { recursive: true, force: true })
})

function write(rel, content) {
  fs.writeFileSync(path.join(TMP, rel), content)
}

describe('nunjucks incremental rebuilds', () => {
  beforeEach(() => {
    write('src/index.njk', '---\ntitle: Home\n---\n{% include "header.njk" %} home body')
    write('src/about.njk', '---\ntitle: About\n---\nabout body')
    write('src/_partials/header.njk', 'HEADER-V1')
  })

  it('records page → partial dependencies during a full compile', async() => {
    const markups = makeMarkups()
    await markups.compile()

    const pages = markups.engine.pagesDependingOn(path.join('src', '_partials', 'header.njk'))
    expect(pages).toEqual([path.join(TMP, 'src', 'index.njk')])
  })

  it('partial edit re-renders only the dependent pages', async() => {
    const markups = makeMarkups()
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    write('src/_partials/header.njk', 'HEADER-V2-LONGER')
    await markups.compileIncremental(path.join('src', '_partials', 'header.njk'))

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(path.join(TMP, 'dist', 'index.html'), 'utf-8')).toContain('HEADER-V2-LONGER')
  })

  it('page content edit re-renders only that page', async() => {
    const markups = makeMarkups()
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    write('src/about.njk', '---\ntitle: About\n---\nabout body updated longer')
    await markups.compileIncremental(path.join('src', 'about.njk'))

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(path.join(TMP, 'dist', 'about.html'), 'utf-8')).toContain('about body updated longer')
  })

  it('falls back to a full compile for a file no page depends on', async() => {
    write('src/_partials/orphan.njk', 'unused')
    const markups = makeMarkups()
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    write('src/_partials/orphan.njk', 'still unused, changed')
    await markups.compileIncremental(path.join('src', '_partials', 'orphan.njk'))

    expect(renderSpy).toHaveBeenCalledTimes(2) // full compile: both pages
  })

  it('falls back to a full compile for a deleted file', async() => {
    const markups = makeMarkups()
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    fs.rmSync(path.join(TMP, 'src', 'about.njk'))
    await markups.compileIncremental(path.join('src', 'about.njk'))

    expect(renderSpy).toHaveBeenCalledTimes(1) // full compile: only index remains
  })

  it('front matter drift escalates to a full compile when nav is enabled', async() => {
    const markups = makeMarkups({ nav: 'nav.json', searchIndex: 'search-index.json' })
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    write('src/about.njk', '---\ntitle: Renamed About\n---\nabout body')
    await markups.compileIncremental(path.join('src', 'about.njk'))

    // one incremental render, then escalation re-renders both pages
    expect(renderSpy).toHaveBeenCalledTimes(3)
  })

  it('content-only edit patches the search index without a full compile', async() => {
    const markups = makeMarkups({ nav: 'nav.json', searchIndex: 'search-index.json' })
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    write('src/about.njk', '---\ntitle: About\n---\nflibbertigibbet flibbertigibbet flibbertigibbet')
    await markups.compileIncremental(path.join('src', 'about.njk'))

    expect(renderSpy).toHaveBeenCalledTimes(1)
    const index = JSON.parse(fs.readFileSync(path.join(TMP, 'dist', 'search-index.json'), 'utf-8'))
    const about = index.find((e) => e.url === 'about.html')
    expect(about.keywords).toContain('flibbertigibbet')
    expect(about._src).toBeUndefined()
  })
})

describe('liquid incremental rebuilds', () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TMP, 'src', '_snippets'), { recursive: true })
    write('src/index.liquid', "---\ntitle: Home\n---\n{% render 'header' %} home body")
    write('src/about.liquid', '---\ntitle: About\n---\nabout body')
    write('src/_snippets/header.liquid', 'HEADER-V1')
  })

  it('partial edit re-renders only the dependent pages', async() => {
    const markups = makeMarkups({ engine: 'liquid' })
    markups.engineName = 'liquid'
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    write('src/_snippets/header.liquid', 'HEADER-V2-LONGER')
    await markups.compileIncremental(path.join('src', '_snippets', 'header.liquid'))

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(path.join(TMP, 'dist', 'index.html'), 'utf-8')).toContain('HEADER-V2-LONGER')
  })

  it('page content edit re-renders only that page', async() => {
    const markups = makeMarkups({ engine: 'liquid' })
    await markups.compile()

    const renderSpy = jest.spyOn(markups.engine, 'render')
    write('src/about.liquid', '---\ntitle: About\n---\nabout body updated longer')
    await markups.compileIncremental(path.join('src', 'about.liquid'))

    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(path.join(TMP, 'dist', 'about.html'), 'utf-8')).toContain('about body updated longer')
  })
})
