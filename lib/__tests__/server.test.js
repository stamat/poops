import { it, describe, expect, beforeAll, afterAll } from '@jest/globals'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createStaticHandler, parseRange } from '../server.js'

describe('parseRange', () => {
  it('returns null when the header is absent', () => {
    expect(parseRange(undefined, 100)).toBe(null)
  })

  it('parses a bounded range', () => {
    expect(parseRange('bytes=0-49', 100)).toEqual({ start: 0, end: 49 })
  })

  it('clamps end to the file size', () => {
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 })
  })

  it('parses an open-ended range', () => {
    expect(parseRange('bytes=25-', 100)).toEqual({ start: 25, end: 99 })
  })

  it('parses a suffix range (last N bytes)', () => {
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 })
  })

  it('flags out-of-file and empty-suffix ranges unsatisfiable', () => {
    expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable')
    expect(parseRange('bytes=-0', 100)).toBe('unsatisfiable')
  })

  it('ignores malformed and multipart ranges (serve full file)', () => {
    expect(parseRange('bytes=-', 100)).toBe(null)
    expect(parseRange('bytes=0-10,20-30', 100)).toBe(null)
    expect(parseRange('chunks=0-10', 100)).toBe(null)
  })
})

describe('createStaticHandler', () => {
  let baseDir, server, origin

  beforeAll((done) => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poops-server-'))
    fs.writeFileSync(path.join(baseDir, 'index.html'), '<h1>home</h1>')
    fs.writeFileSync(path.join(baseDir, '404.html'), 'custom 404')
    fs.writeFileSync(path.join(baseDir, 'video.mp4'), '0123456789')
    fs.mkdirSync(path.join(baseDir, 'docs'))
    fs.writeFileSync(path.join(baseDir, 'docs', 'index.html'), 'docs')
    server = http.createServer(createStaticHandler(baseDir)).listen(0, () => {
      origin = `http://localhost:${server.address().port}`
      done()
    })
  })

  afterAll((done) => {
    fs.rmSync(baseDir, { recursive: true, force: true })
    server.close(done)
  })

  it('serves index.html at / with the html MIME type', async() => {
    const res = await fetch(`${origin}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toBe('<h1>home</h1>')
  })

  it('redirects /dir to /dir/ then serves its index', async() => {
    const res = await fetch(`${origin}/docs`, { redirect: 'manual' })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/docs/')
    expect(await (await fetch(`${origin}/docs/`)).text()).toBe('docs')
  })

  it('serves 404.html for missing paths', async() => {
    const res = await fetch(`${origin}/nope.html`)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('custom 404')
  })

  it('rejects path traversal', async() => {
    const res = await fetch(`${origin}/%2e%2e/%2e%2e/etc/passwd`)
    expect(res.status).toBe(404)
  })

  it('serves a byte range as 206 with the right slice', async() => {
    const res = await fetch(`${origin}/video.mp4`, { headers: { Range: 'bytes=2-5' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(res.headers.get('content-length')).toBe('4')
    expect(await res.text()).toBe('2345')
  })

  it('serves a suffix range', async() => {
    const res = await fetch(`${origin}/video.mp4`, { headers: { Range: 'bytes=-3' } })
    expect(res.status).toBe(206)
    expect(await res.text()).toBe('789')
  })

  it('answers 416 for an unsatisfiable range', async() => {
    const res = await fetch(`${origin}/video.mp4`, { headers: { Range: 'bytes=99-' } })
    expect(res.status).toBe(416)
    expect(res.headers.get('content-range')).toBe('bytes */10')
  })

  it('advertises Accept-Ranges on full responses', async() => {
    const res = await fetch(`${origin}/video.mp4`)
    expect(res.status).toBe(200)
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(await res.text()).toBe('0123456789')
  })

  it('answers HEAD with headers only', async() => {
    const res = await fetch(`${origin}/video.mp4`, { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBe('10')
    expect(await res.text()).toBe('')
  })

  it('rejects other methods with 405', async() => {
    const res = await fetch(`${origin}/`, { method: 'POST' })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('GET, HEAD')
  })
})
