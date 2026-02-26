import { it, describe, expect } from '@jest/globals'
import { ImageExtension, GoogleFontsExtension } from '../extensions.js'

describe('ImageExtension', () => {
  it('has the "image" tag', () => {
    const ext = new ImageExtension(() => '/tmp')
    expect(ext.tags).toEqual(['image'])
  })

  it('run returns img tag with src and alt', () => {
    const ext = new ImageExtension(() => '/nonexistent')
    const context = { lookup: () => '' }
    const result = ext.run(context, 'photo.jpg', { alt: 'A photo' })
    expect(result.toString()).toContain('src="photo.jpg"')
    expect(result.toString()).toContain('alt="A photo"')
    expect(result.toString()).toContain('loading="lazy"')
  })

  it('run defaults alt to empty string', () => {
    const ext = new ImageExtension(() => '/nonexistent')
    const context = { lookup: () => '' }
    const result = ext.run(context, 'photo.jpg', {})
    expect(result.toString()).toContain('alt=""')
  })

  it('run prepends relativePathPrefix to src', () => {
    const ext = new ImageExtension(() => '/nonexistent')
    const context = { lookup: (key) => key === 'relativePathPrefix' ? '../../' : '' }
    const result = ext.run(context, 'photo.jpg', {})
    expect(result.toString()).toContain('src="../../photo.jpg"')
  })

  it('run passes through extra attributes', () => {
    const ext = new ImageExtension(() => '/nonexistent')
    const context = { lookup: () => '' }
    const result = ext.run(context, 'photo.jpg', { alt: 'test', class: 'hero', id: 'main' })
    const html = result.toString()
    expect(html).toContain('class="hero"')
    expect(html).toContain('id="main"')
  })

  it('run skips kwargs keys starting with __', () => {
    const ext = new ImageExtension(() => '/nonexistent')
    const context = { lookup: () => '' }
    const result = ext.run(context, 'photo.jpg', { __keywords: true, alt: 'test' })
    expect(result.toString()).not.toContain('__keywords')
  })

  it('run uses original path for SVG without srcset or sizes', () => {
    const ext = new ImageExtension(() => '/nonexistent')
    const context = { lookup: () => '' }
    const result = ext.run(context, 'icons/logo.svg', { alt: 'Logo' })
    const html = result.toString()
    expect(html).toContain('src="icons/logo.svg"')
    expect(html).toContain('alt="Logo"')
    expect(html).not.toContain('srcset')
    expect(html).not.toContain('sizes')
  })

  it('run prepends prefix for SVG paths', () => {
    const ext = new ImageExtension(() => '/nonexistent')
    const context = { lookup: (key) => key === 'relativePathPrefix' ? '../../' : '' }
    const result = ext.run(context, 'icons/logo.svg', {})
    expect(result.toString()).toContain('src="../../icons/logo.svg"')
  })
})

describe('GoogleFontsExtension', () => {
  const ext = new GoogleFontsExtension()

  it('has the "googleFonts" tag', () => {
    expect(ext.tags).toEqual(['googleFonts'])
  })

  it('returns empty string for null/empty input', () => {
    expect(ext.run({}, null, {}).toString()).toBe('')
    expect(ext.run({}, [], {}).toString()).toBe('')
  })

  it('generates link tags for a single font string', () => {
    const html = ext.run({}, 'Open Sans', {}).toString()
    expect(html).toContain('href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap"')
    expect(html).toContain('rel="preconnect"')
    expect(html).toContain('fonts.gstatic.com')
  })

  it('generates link tags for multiple font strings', () => {
    const html = ext.run({}, ['Roboto', 'Open Sans'], {}).toString()
    expect(html).toContain('family=Roboto')
    expect(html).toContain('family=Open+Sans')
  })

  it('supports font objects with weights', () => {
    const fonts = [{ name: 'Roboto', weights: [400, 700] }]
    const html = ext.run({}, fonts, {}).toString()
    expect(html).toContain('family=Roboto:wght@400;700')
  })

  it('supports italic variants', () => {
    const fonts = [{ name: 'Roboto', weights: [400, 700], ital: true }]
    const html = ext.run({}, fonts, {}).toString()
    expect(html).toContain('ital,wght@')
    expect(html).toContain('0,400')
    expect(html).toContain('1,400')
    expect(html).toContain('0,700')
    expect(html).toContain('1,700')
  })

  it('respects custom display option', () => {
    const html = ext.run({}, 'Roboto', { display: 'block' }).toString()
    expect(html).toContain('display=block')
  })

  it('defaults display to swap', () => {
    const html = ext.run({}, 'Roboto', {}).toString()
    expect(html).toContain('display=swap')
  })
})
