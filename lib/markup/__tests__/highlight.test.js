import { it, describe, expect } from '@jest/globals'
import { Marked } from 'marked'
import { highlightCode, highlightRenderer, fenceAttrs, codeBlock } from '../highlight.js'

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

  // A fence's meta words used to reach getLanguage, which then missed and
  // handed the block to auto-detection.
  it('ignores meta words after the language in a fence info string', () => {
    expect(highlightCode('const x = 1;', 'javascript preview')).toBe(highlightCode('const x = 1;', 'javascript'))
  })
})

describe('fenceAttrs', () => {
  it('emits just the language class for a plain fence', () => {
    expect(fenceAttrs('js')).toBe(' class="hljs language-js"')
  })

  it('emits nothing but hljs for an empty info string', () => {
    expect(fenceAttrs('')).toBe(' class="hljs"')
    expect(fenceAttrs(undefined)).toBe(' class="hljs"')
  })

  it('turns bare meta words into classes', () => {
    expect(fenceAttrs('html preview expanded')).toBe(' class="hljs language-html preview expanded"')
  })

  it('turns key=value tokens into data attributes', () => {
    expect(fenceAttrs('html preview tab=options widths=375,768'))
      .toBe(' class="hljs language-html preview" data-tab="options" data-widths="375,768"')
  })

  // A bare word is a class, not a valueless attribute — `code.preview` is what
  // the consumer selects on. A trailing `=` is how you ask for an empty one.
  it('emits an empty data attribute for a key with no value', () => {
    expect(fenceAttrs('html expanded=')).toBe(' class="hljs language-html" data-expanded=""')
  })

  it('drops a token with no key and keeps `=` inside a value', () => {
    expect(fenceAttrs('html =x')).toBe(' class="hljs language-html"')
    expect(fenceAttrs('html tab=a=b')).toBe(' class="hljs language-html" data-tab="a=b"')
  })

  it('strips characters that would break out of the attribute', () => {
    expect(fenceAttrs('html pre"view on<click>=1 tab="x"'))
      .toBe(' class="hljs language-html preview" data-onclick="1" data-tab="&quot;x&quot;"')
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

// A mermaid fence is a picture to draw, not code to read. hljs has no mermaid
// grammar, so what these guard against is the old behaviour: auto-detection
// guessing a language and wrapping the diagram source in spans for it.
describe('mermaid fences', () => {
  it('leaves the diagram source alone instead of guessing a language for it', () => {
    const result = highlightCode('graph TD; A-->B;', 'mermaid')
    expect(result).toBe('graph TD; A--&gt;B;')
    expect(result).not.toContain('hljs-')
  })

  it('carries the class mermaid itself looks for, and no code element', () => {
    expect(codeBlock('graph TD; A--&gt;B;', 'mermaid'))
      .toBe('<pre class="mermaid">graph TD; A--&gt;B;</pre>')
  })

  it('a diagram carrying a closing tag cannot close the block it sits in', () => {
    const result = highlightCode('graph TD; A["</pre><script>alert(1)</script>"];', 'mermaid')
    expect(result).not.toContain('</pre>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;/pre&gt;')
  })

  it('keeps the fence info string working — extra words and key=value alike', () => {
    expect(codeBlock('graph TD;', 'mermaid wide tab=diagram'))
      .toBe('<pre class="mermaid wide" data-tab="diagram">graph TD;</pre>')
  })

  it('is the language name only, so a fence about mermaid is still code', () => {
    const result = highlightCode('const mermaid = 1;', 'javascript')
    expect(result).toContain('hljs-')
  })

  it('renders a mermaid fence through markdown as a diagram block', () => {
    const result = parseMarkdown('```mermaid\ngraph TD; A-->B;\n```')
    expect(result).toContain('<pre class="mermaid">')
    expect(result).not.toContain('<code')
    expect(result).toContain('A--&gt;B;')
  })
})
