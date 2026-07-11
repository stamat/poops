import { it, describe, expect, beforeAll } from '@jest/globals'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import NunjucksEngine from '../engines/nunjucks.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(__dirname, 'fixtures')

// Filters are registered as inline lambdas on the engine, not exported
// functions — so exercise them through renderString, the surface templates
// actually use.
let engine
const render = (src, ctx = {}) => engine.renderString(src, ctx)

beforeAll(() => {
  engine = new NunjucksEngine(FIXTURES, [], {})
  engine.registerFilters({ timeDateFormat: 'YYYY-MM-DD', markupOut: 'nonexistent' })
})

describe('slugify filter', () => {
  it('converts to lowercase kebab-case', async() => {
    expect(await render('{{ "Hello World" | slugify }}')).toBe('hello-world')
  })

  it('collapses runs of non-alphanumerics to a single dash', async() => {
    expect(await render('{{ "Foo & Bar @ Baz" | slugify }}')).toBe('foo-bar-baz')
  })
})

describe('jsonify filter', () => {
  it('serializes objects', async() => {
    expect(await render('{{ obj | jsonify }}', { obj: { a: 1 } })).toBe('{"a":1}')
  })

  it('serializes arrays', async() => {
    expect(await render('{{ arr | jsonify }}', { arr: [1, 2] })).toBe('[1,2]')
  })
})

describe('markdown filter', () => {
  it('converts markdown to HTML', async() => {
    expect(await render('{{ "**bold**" | markdown }}')).toContain('<strong>bold</strong>')
  })

  it('renders GitHub-style emoji shortcodes', async() => {
    expect(await render('{{ "Hi :wave:" | markdown }}')).toContain('👋')
  })

  it('returns empty output for undefined input instead of throwing', async() => {
    expect(await render('{{ nope | markdown }}', {})).toBe('')
  })
})

describe('concat filter', () => {
  it('appends a value without mutating the source', async() => {
    expect(await render('{{ ([1,2] | concat(3)) | jsonify }}')).toBe('[1,2,3]')
  })

  it('wraps non-array input in a new array', async() => {
    expect(await render('{{ (nope | concat("a")) | jsonify }}', { nope: null })).toBe('["a"]')
  })
})

describe('push filter', () => {
  it('appends a value to the array', async() => {
    expect(await render('{{ ([1,2] | push(3)) | jsonify }}')).toBe('[1,2,3]')
  })
})

describe('date filter', () => {
  // Noon-anchored inputs so the local-time formatting stays on the same
  // calendar day in any test-runner timezone.
  it('formats with an explicit template', async() => {
    expect(await render('{{ "2024-06-15T12:00:00" | date("YYYY-MM-DD") }}')).toBe('2024-06-15')
  })

  it('falls back to the configured default format', async() => {
    expect(await render('{{ "2024-06-15T12:00:00" | date }}')).toBe('2024-06-15')
  })

  it('uses the current date for empty input', async() => {
    expect(await render('{{ "" | date("YYYY") }}')).toBe(String(new Date().getFullYear()))
  })
})

describe('svg filter', () => {
  const iconRel = path.relative(process.cwd(), path.join(FIXTURES, 'icon.svg'))

  it('inlines SVG file contents', async() => {
    const out = await render('{{ p | svg }}', { p: iconRel })
    expect(out).toContain('<svg')
    expect(out).toContain('<circle')
  })

  it('returns empty string for a non-SVG file', async() => {
    const p = path.relative(process.cwd(), path.join(FIXTURES, 'not-svg.txt'))
    expect(await render('{{ p | svg }}', { p })).toBe('')
  })

  it('returns empty string for a missing file', async() => {
    expect(await render('{{ "nope.svg" | svg }}')).toBe('')
  })
})

describe('srcset filter', () => {
  it('returns empty string when no variants exist', async() => {
    expect(await render('{{ "nonexistent/image.jpg" | srcset }}')).toBe('')
  })
})

describe('groupby filter', () => {
  it('groups items by a date part, preserving order', async() => {
    const items = [{ d: '2024-01-01' }, { d: '2023-01-01' }, { d: '2024-06-01' }]
    const out = await render(
      '{% for g in items | groupby("d","year") %}{{ g.key }}:{{ g.items.length }} {% endfor %}',
      { items }
    )
    expect(out.trim()).toBe('2024:2 2023:1')
  })
})

describe('highlight filter', () => {
  it('wraps highlighted code in pre/code tags', async() => {
    const out = await render('{{ "const x = 1;" | highlight("js") }}')
    expect(out).toContain('<pre><code class="hljs language-js">')
    expect(out).toContain('</code></pre>')
    expect(out).toContain('<span')
  })

  it('works without a language', async() => {
    expect(await render('{{ "const x = 1;" | highlight }}')).toContain('<pre><code class="hljs">')
  })
})
