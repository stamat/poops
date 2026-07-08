import { afterEach, it, describe, expect } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getImageEntry, getImageExif, listImages, clearImageCache } from '../image-cache.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(__dirname, 'fixtures', '_tmp-image-cache')

afterEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true })
  clearImageCache()
})

function writeCache(dir, entries) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '.poops-images-cache.json'), JSON.stringify({ configHash: 'abc', entries }))
}

const EXIF = {
  make: 'Apple',
  model: 'iPhone 15 Pro',
  dateTime: '2025-12-02T16:48:32.000Z',
  gps: {
    latitude: { decimal: 38.262833 },
    longitude: { decimal: 140.880631 },
    googleMapsUrl: 'https://www.google.com/maps?q=38.262833,140.880631'
  }
}

describe('getImageEntry', () => {
  it('finds an entry by exact key', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpg': { width: 4400, height: 3300, exif: null, outputs: [] }
    })

    const found = getImageEntry('images/photo.jpg', TMP)
    expect(found).not.toBeNull()
    expect(found.entry.width).toBe(4400)
    expect(found.prefixDir).toBe('images')
  })

  it('matches when the extension was converted (heic → jpg)', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.heic': { width: 3024, height: 4032, exif: null, outputs: [] }
    })

    const found = getImageEntry('images/photo.jpg', TMP)
    expect(found).not.toBeNull()
    expect(found.entry.height).toBe(4032)
  })

  it('walks up from nested image paths to the cache dir', () => {
    writeCache(path.join(TMP, 'images'), {
      '2024/photo.jpg': { width: 100, height: 50, exif: null, outputs: [] }
    })

    const found = getImageEntry('images/2024/photo.jpg', TMP)
    expect(found).not.toBeNull()
    expect(found.entry.width).toBe(100)
    expect(found.prefixDir).toBe('images')
  })

  it('finds a cache at the output root with empty prefixDir', () => {
    writeCache(TMP, {
      'photo.jpg': { width: 100, height: 50, exif: null, outputs: [] }
    })

    const found = getImageEntry('photo.jpg', TMP)
    expect(found).not.toBeNull()
    expect(found.prefixDir).toBe('')
  })

  it('returns null when there is no cache file', () => {
    fs.mkdirSync(path.join(TMP, 'images'), { recursive: true })
    expect(getImageEntry('images/photo.jpg', TMP)).toBeNull()
  })

  it('returns null for an unknown image', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpg': { width: 100, height: 50, exif: null, outputs: [] }
    })
    expect(getImageEntry('images/other.jpg', TMP)).toBeNull()
  })

  it('rereads the cache file when it changes on disk', () => {
    const dir = path.join(TMP, 'images')
    writeCache(dir, { 'photo.jpg': { width: 100, height: 50, exif: null, outputs: [] } })
    expect(getImageEntry('images/photo.jpg', TMP).entry.width).toBe(100)

    writeCache(dir, { 'photo.jpg': { width: 200, height: 100, exif: null, outputs: [] } })
    const later = Date.now() / 1000 + 10
    fs.utimesSync(path.join(dir, '.poops-images-cache.json'), later, later)
    expect(getImageEntry('images/photo.jpg', TMP).entry.width).toBe(200)
  })
})

describe('listImages', () => {
  it('lists entries with site-relative paths and flattened date', () => {
    writeCache(path.join(TMP, 'images'), {
      'a.jpg': {
        mtime: 1772140715303,
        width: 100,
        height: 50,
        exif: EXIF,
        outputs: [{ path: 'a-320w.jpg', width: 320, height: 160 }]
      },
      'b.jpg': { mtime: 1772140715303, width: 200, height: 100, exif: null, outputs: [] }
    })

    const images = listImages('images', TMP)
    expect(images.length).toBe(2)
    expect(images[0].path).toBe('images/a.jpg')
    expect(images[0].date).toBe('2025-12-02T16:48:32.000Z')
    expect(images[0].exif.model).toBe('iPhone 15 Pro')
    expect(images[0].outputs[0].path).toBe('images/a-320w.jpg')
    expect(images[1].date).toBe(new Date(1772140715303).toISOString())
  })

  it('scopes to a subdirectory of the cache dir', () => {
    writeCache(path.join(TMP, 'images'), {
      '2024/a.jpg': { width: 100, height: 50, exif: null, outputs: [] },
      '2025/b.jpg': { width: 100, height: 50, exif: null, outputs: [] }
    })

    const images = listImages('images/2025', TMP)
    expect(images.map(i => i.path)).toEqual(['images/2025/b.jpg'])
  })

  it('accepts trailing and leading slashes', () => {
    writeCache(path.join(TMP, 'images'), {
      'a.jpg': { width: 100, height: 50, exif: null, outputs: [] }
    })

    expect(listImages('/images/', TMP).length).toBe(1)
  })

  it('returns an empty array when there is no cache', () => {
    expect(listImages('images', TMP)).toEqual([])
  })
})

describe('getImageExif', () => {
  it('returns the exif object for an image', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpeg': { width: 3024, height: 4032, exif: EXIF, outputs: [] }
    })

    const exif = getImageExif('images/photo.jpeg', TMP)
    expect(exif.model).toBe('iPhone 15 Pro')
    expect(exif.gps.googleMapsUrl).toBe('https://www.google.com/maps?q=38.262833,140.880631')
  })

  it('returns null when there is no exif data', () => {
    writeCache(path.join(TMP, 'images'), {
      'photo.jpg': { width: 100, height: 50, exif: null, outputs: [] }
    })
    expect(getImageExif('images/photo.jpg', TMP)).toBeNull()
  })

  it('returns null when the image is not in the cache', () => {
    expect(getImageExif('images/photo.jpg', TMP)).toBeNull()
  })
})
