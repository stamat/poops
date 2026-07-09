import { afterEach, it, describe, expect, jest } from '@jest/globals'
import Images from '../images.js'

// poops-images is an optional peer dependency, normally absent from this repo's
// node_modules, so import('poops-images') throws MODULE_NOT_FOUND — exactly the
// "configured but not installed" path. Guard it so a stray local install (e.g.
// a symlink during manual e2e) doesn't turn this into a confusing failure.
const poopsImagesInstalled = await import('poops-images').then(() => true, () => false)

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Images runner', () => {
  it('is a no-op when no images config is present', async() => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const images = new Images({})
    await expect(images.compile()).resolves.toBeUndefined()

    expect(logSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    expect(images.disabled).toBe(true)
    expect(images.processor).toBeNull()
  })

  const maybeIt = poopsImagesInstalled ? it.skip : it
  maybeIt('warns and disables (no throw) when configured but poops-images is not installed', async() => {
    const lines = []
    jest.spyOn(console, 'log').mockImplementation((msg) => lines.push(String(msg)))

    const images = new Images({ images: { in: 'src/images', out: 'dist/images' } })
    await expect(images.compile()).resolves.toBeUndefined()

    expect(lines.join('\n')).toMatch(/not installed/)
    expect(images.disabled).toBe(true)
    expect(images.processor).toBeNull()
  })

  it('remove() is a no-op when disabled', async() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const images = new Images({})
    await expect(images.remove('whatever.jpg')).resolves.toBeUndefined()
  })
})
