import { it, describe, expect } from '@jest/globals'
import { slugify, jsonify, markdown, dateFilter, srcsetFilter } from '../filters.js'

describe('slugify', () => {
  it('converts to lowercase kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('trims whitespace', () => {
    expect(slugify('  Hello  ')).toBe('hello')
  })

  it('replaces multiple non-alphanumeric chars with single dash', () => {
    expect(slugify('Foo & Bar @ Baz')).toBe('foo-bar-baz')
  })

  it('handles already slugified strings', () => {
    expect(slugify('already-slug')).toBe('already-slug')
  })
})

describe('jsonify', () => {
  it('serializes objects to JSON', () => {
    expect(jsonify({ a: 1 })).toBe('{"a":1}')
  })

  it('serializes arrays', () => {
    expect(jsonify([1, 2])).toBe('[1,2]')
  })

  it('serializes strings', () => {
    expect(jsonify('hello')).toBe('"hello"')
  })
})

describe('markdown', () => {
  it('converts markdown to HTML', () => {
    const result = markdown('**bold**')
    expect(result).toContain('<strong>bold</strong>')
  })

  it('converts headings', () => {
    const result = markdown('# Title')
    expect(result).toContain('<h1')
    expect(result).toContain('Title')
  })
})

describe('dateFilter', () => {
  it('formats a date string with given template', () => {
    expect(dateFilter('2024-01-15', 'YYYY-MM-DD')).toBe('2024-01-15')
  })

  it('formats with default format when template is omitted', () => {
    expect(dateFilter('2024-01-15', null, 'YYYY')).toBe('2024')
  })

  it('returns string unchanged when no template and no default', () => {
    expect(dateFilter('2024-01-15', null, null)).toBe('2024-01-15')
  })

  it('uses current date for empty string input', () => {
    const result = dateFilter('', 'YYYY')
    expect(result).toBe(String(new Date().getFullYear()))
  })
})

describe('srcsetFilter', () => {
  it('returns empty string when no variants found', () => {
    expect(srcsetFilter('nonexistent/image.jpg', 'nonexistent')).toBe('')
  })
})
