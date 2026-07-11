import { it, describe, expect } from '@jest/globals'
import { marked, renderMarkdown } from '../renderer.js'

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

  it('renders GitHub-style emoji shortcodes', () => {
    const result = parseMarkdown('Hi :wave: :rocket:')
    expect(result).toContain('👋')
    expect(result).toContain('🚀')
  })

  it('renders :octocat: as a GitHub emoji image', () => {
    const result = parseMarkdown('Hi :octocat:')
    expect(result).toContain('class="gh-emoji"')
    expect(result).toContain('alt=":octocat:"')
    expect(result).toContain('octocat.png')
  })

  it('renders GitHub alert blockquotes as alert divs', () => {
    const result = parseMarkdown('> [!TIP]\n> Ship the smallest working diff.')
    expect(result).toContain('marked-github-alert')
    expect(result).toContain('marked-github-alert-tip')
    expect(result).toContain('marked-github-alert-icon')
    expect(result).not.toContain('<blockquote>')
  })
})

describe('renderMarkdown raw block protection', () => {
  it('keeps {% raw %} delimiters intact through fenced code highlighting', () => {
    const src = '```json\n{% raw %}{\n  "banner": "/* {{ name }} v{{ version }} */"\n}{% endraw %}\n```'
    const result = renderMarkdown(src)
    expect(result).toContain('{% raw %}')
    expect(result).toContain('{% endraw %}')
    // the template variables survive as text (possibly wrapped in hljs spans)
    expect(result.replace(/<[^>]+>/g, '')).toContain('{{ name }} v{{ version }}')
  })

  it('escapes single-line raw content without adding highlight spans', () => {
    const result = renderMarkdown('Use `{% raw %}{{ x < y }}{% endraw %}` inline.')
    expect(result).toContain('{% raw %}{{ x &lt; y }}{% endraw %}')
    expect(result).not.toContain('hljs')
  })

  it('renders markdown outside raw blocks normally', () => {
    const result = renderMarkdown('## Title\n\n{% raw %}{{ keep }}{% endraw %}')
    expect(result).toContain('<h2 id="title">')
    expect(result).toContain('{% raw %}{{ keep }}{% endraw %}')
  })
})
