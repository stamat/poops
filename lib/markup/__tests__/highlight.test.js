import { it, describe, expect } from '@jest/globals'
import { Marked } from 'marked'
import { highlightCode, highlightRenderer } from '../highlight.js'

const marked = new Marked({ renderer: highlightRenderer })
const parseMarkdown = (str) => marked.parse(str)

// The `highlight` filter is covered in filters.test.js and HighlightExtension
// in extensions.test.js — this file covers highlight.js directly.

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
