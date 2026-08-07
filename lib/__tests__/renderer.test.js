// The markdown renderer's HTML output, where that output is a promise to somebody: a heading
// anchor is markup every themed site inherits, and it lands in the accessibility tree of every
// page poops builds.
//
// Deliberately not covered: highlighting, which is highlight.js', and the slug function, which
// has its own shape and its own edge cases. What is here is the heading anchor's attributes,
// because that is the part a reader is exposed to and the part no build failure would catch.
import { it, describe, expect } from '@jest/globals'
// The configured instance the build actually renders with, not a bare `Marked` wearing the
// same renderer: the plugins are part of what ships, so this is the output sites really get.
import { marked } from '../markup/renderer.js'

const render = (md) => marked.parse(md)

describe('the heading permalink anchor', () => {
  it('is out of the tab order whenever it is out of the accessibility tree', async() => {
    const html = await render('## Getting started')
    // aria-hidden without tabindex="-1" is a link a keyboard reaches and a screen reader
    // cannot name: a tab stop on nothing.
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('tabindex="-1"')
  })

  it('carries no accessible name it has already hidden', async() => {
    const html = await render('## Getting started')
    // An aria-label under aria-hidden is never read to anyone; the heading beside it is
    // already the name of the place.
    expect(html).not.toContain('aria-label')
  })

  it('still points at the heading it belongs to', async() => {
    const html = await render('## Getting started')
    expect(html).toContain('id="getting-started"')
    expect(html).toContain('href="#getting-started"')
  })

  it('leaves a heading that slugs to nothing without an anchor at all', async() => {
    // No id means no target, and an anchor pointing at "#" is worse than none.
    const html = await render('## ---')
    expect(html).not.toContain('heading-anchor')
  })
})
