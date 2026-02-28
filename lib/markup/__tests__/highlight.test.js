import { it, describe, expect } from '@jest/globals'
import { Marked } from 'marked'
import { highlightCode, highlightRenderer } from '../highlight.js'
import { highlight } from '../filters.js'

const marked = new Marked({ renderer: highlightRenderer })
const parseMarkdown = (str) => marked.parse(str)
import { HighlightExtension } from '../extensions.js'

describe('highlightCode', () => {
  it('highlights JavaScript code with specified language', () => {
    const result = highlightCode('const x = 1;', 'javascript')
    expect(result).toContain('<span')
    expect(result).toContain('hljs-')
  })

  it('highlights with short language aliases', () => {
    const result = highlightCode('const x = 1;', 'js')
    expect(result).toContain('<span')
    expect(result).toContain('hljs-')
  })

  it('falls back to auto-detection when language is not specified', () => {
    const result = highlightCode('function hello() { return "world"; }')
    expect(result).toBeTruthy()
  })

  it('falls back to auto-detection for unknown language', () => {
    const result = highlightCode('some code', 'unknownlang')
    expect(result).toBeTruthy()
  })

  it('handles empty string', () => {
    const result = highlightCode('', 'js')
    expect(result).toBe('')
  })

  it('is case-insensitive for language names', () => {
    const result = highlightCode('const x = 1;', 'JavaScript')
    expect(result).toContain('<span')
  })
})

describe('parseMarkdown', () => {
  it('highlights fenced code blocks', () => {
    const md = '```javascript\nconst x = 1;\n```'
    const result = parseMarkdown(md)
    expect(result).toContain('class="hljs language-javascript"')
    expect(result).toContain('<span')
    expect(result).toContain('<pre><code')
  })

  it('handles code blocks without language', () => {
    const md = '```\nplain text\n```'
    const result = parseMarkdown(md)
    expect(result).toContain('class="hljs"')
    expect(result).toContain('<pre><code')
  })

  it('still renders non-code markdown normally', () => {
    const result = parseMarkdown('**bold** text')
    expect(result).toContain('<strong>bold</strong>')
  })
})

describe('highlight filter', () => {
  it('wraps highlighted code in pre/code tags', () => {
    const result = highlight('const x = 1;', 'js')
    expect(result).toContain('<pre><code class="hljs language-js">')
    expect(result).toContain('</code></pre>')
    expect(result).toContain('<span')
  })

  it('works without language', () => {
    const result = highlight('const x = 1;')
    expect(result).toContain('<pre><code class="hljs">')
  })
})

describe('HighlightExtension', () => {
  const ext = new HighlightExtension()

  it('has the "highlight" tag', () => {
    expect(ext.tags).toEqual(['highlight'])
  })

  it('run highlights code and returns SafeString', () => {
    const context = {}
    const body = () => 'const x = 1;'
    const result = ext.run(context, 'javascript', body)
    const html = result.toString()
    expect(html).toContain('<pre><code class="hljs language-javascript">')
    expect(html).toContain('<span')
    expect(html).toContain('</code></pre>')
  })

  it('run works without language', () => {
    const context = {}
    const body = () => 'hello world'
    const result = ext.run(context, null, body)
    const html = result.toString()
    expect(html).toContain('<pre><code class="hljs">')
  })
})
