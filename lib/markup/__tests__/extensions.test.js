import { it, describe, expect } from '@jest/globals'
import { ImageExtension } from '../extensions.js'

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
})
