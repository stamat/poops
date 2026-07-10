import { it, describe, expect } from '@jest/globals'
import { marked } from '../renderer.js'

const parseMarkdown = (str) => marked.parse(str)

describe('heading renderer', () => {
  it('adds a slug id and a permalink anchor', () => {
    const result = parseMarkdown('## Hello World')
    expect(result).toContain('<h2 id="hello-world">')
    expect(result).toContain('href="#hello-world"')
    expect(result).toContain('class="heading-anchor"')
  })

  it('slugifies punctuation and inline markup consistently', () => {
    const result = parseMarkdown('### Foo & **Bar**')
    expect(result).toContain('id="foo-bar"')
    expect(result).toContain('<strong>Bar</strong>')
  })

  it('renders a plain heading when the slug would be empty', () => {
    const result = parseMarkdown('## ...')
    expect(result).toMatch(/<h2>[.\s]*<\/h2>/)
    expect(result).not.toContain('heading-anchor')
  })

  it('still highlights code (composes the highlight renderer)', () => {
    const result = parseMarkdown('```js\nconst x = 1;\n```')
    expect(result).toContain('class="hljs')
  })
})
