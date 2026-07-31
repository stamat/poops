import { it, describe, expect, beforeAll, afterAll } from '@jest/globals'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createStaticHandler, createReloadHub, injectReloadClient, parseRange, RELOAD_PATH } from '../server.js'

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
    fs.writeFileSync(path.join(baseDir, '404.html'), '<html><head><meta charset="utf-8"></head><body>custom 404</body></html>')
    fs.writeFileSync(path.join(baseDir, 'video.mp4'), '0123456789')
    fs.mkdirSync(path.join(baseDir, 'docs'))
    fs.writeFileSync(path.join(baseDir, 'docs', 'index.html'), 'docs')
    fs.writeFileSync(path.join(baseDir, 'docs', 'about.html'), 'about')
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

  it('serves /a/b as a/b.html without redirecting', async() => {
    const res = await fetch(`${origin}/docs/about`, { redirect: 'manual' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toBe('about')
  })

  it('serves 404.html for missing paths, with a root <base> for its assets', async() => {
    const res = await fetch(`${origin}/deep/missing/page`)
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('<head><base href="/"><meta charset="utf-8">')
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

  // `serve.base: "/"` joins to `<cwd>/`, which used to fail the containment check
  it('serves files when base carries a trailing separator', async() => {
    const handler = createStaticHandler(baseDir + path.sep)
    const trailing = http.createServer(handler)
    await new Promise((resolve) => trailing.listen(0, resolve))
    const trailingOrigin = `http://localhost:${trailing.address().port}`
    try {
      expect((await fetch(`${trailingOrigin}/`)).status).toBe(200)
      expect(await (await fetch(`${trailingOrigin}/docs/index.html`)).text()).toBe('docs')
      expect((await fetch(`${trailingOrigin}/%2e%2e/%2e%2e/etc/passwd`)).status).toBe(404)
    } finally {
      await new Promise((resolve) => trailing.close(resolve))
    }
  })
})

describe('injectReloadClient', () => {
  it('inserts the client before </body>', () => {
    const out = injectReloadClient('<html><body><p>hi</p></body></html>')
    expect(out).toMatch(/<script>[\s\S]*EventSource[\s\S]*<\/script>\s*<\/body><\/html>$/)
  })

  it('appends when the page has no </body>', () => {
    expect(injectReloadClient('<p>fragment</p>')).toMatch(/^<p>fragment<\/p><script>/)
  })

  it('points the client at the reload endpoint', () => {
    expect(injectReloadClient('<body></body>')).toContain(`new EventSource('${RELOAD_PATH}')`)
  })
})

describe('reload channel', () => {
  let baseDir, hub, server, origin

  beforeAll((done) => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poops-reload-'))
    fs.writeFileSync(path.join(baseDir, 'index.html'), '<html><body><h1>home</h1></body></html>')
    fs.writeFileSync(path.join(baseDir, '404.html'), '<html><head></head><body>custom 404</body></html>')
    fs.writeFileSync(path.join(baseDir, 'site.css'), 'body{color:red}')
    hub = createReloadHub()
    server = http.createServer(createStaticHandler(baseDir, hub)).listen(0, () => {
      origin = `http://localhost:${server.address().port}`
      done()
    })
  })

  afterAll((done) => {
    fs.rmSync(baseDir, { recursive: true, force: true })
    server.close(done)
  })

  // One open SSE connection plus a reader that resolves on the next event
  const connect = async() => {
    const ac = new AbortController()
    const res = await fetch(`${origin}${RELOAD_PATH}`, { signal: ac.signal })
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    // The retry preamble arrives first and is not an event
    const preamble = (await reader.read()).value
    return { res, preamble, next: async() => (await reader.read()).value, close: () => ac.abort() }
  }

  it('opens an event stream and asks for a fast reconnect', async() => {
    const client = await connect()
    try {
      expect(client.res.status).toBe(200)
      expect(client.res.headers.get('content-type')).toBe('text/event-stream')
      expect(client.res.headers.get('cache-control')).toBe('no-cache')
      expect(client.preamble).toContain('retry: 1000')
    } finally {
      client.close()
    }
  })

  it('sends a css event carrying the written stylesheet paths', async() => {
    const client = await connect()
    try {
      const received = client.next()
      hub.send('css', ['dist/css/site.css'])
      expect(await received).toBe('event: css\ndata: ["dist/css/site.css"]\n\n')
    } finally {
      client.close()
    }
  })

  it('sends a reload event to every open client', async() => {
    const a = await connect()
    const b = await connect()
    try {
      const both = Promise.all([a.next(), b.next()])
      hub.send('reload', '/')
      expect(await both).toEqual(['event: reload\ndata: "/"\n\n', 'event: reload\ndata: "/"\n\n'])
    } finally {
      a.close()
      b.close()
    }
  })

  it('forgets a client once its connection closes', async() => {
    const client = await connect()
    expect(hub.clients.size).toBe(1)
    client.close()
    // the close event lands on the server's next tick, not on abort()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(hub.clients.size).toBe(0)
  })

  it('injects the client into served HTML, with a matching Content-Length', async() => {
    const res = await fetch(`${origin}/`)
    const body = await res.text()
    expect(body).toContain('<h1>home</h1>')
    expect(body).toContain(`new EventSource('${RELOAD_PATH}')`)
    expect(Number(res.headers.get('content-length'))).toBe(Buffer.byteLength(body))
  })

  it('injects the client into the 404 page too', async() => {
    const res = await fetch(`${origin}/missing`)
    expect(res.status).toBe(404)
    expect(await res.text()).toContain(`new EventSource('${RELOAD_PATH}')`)
  })

  it('leaves non-HTML responses alone', async() => {
    const res = await fetch(`${origin}/site.css`)
    expect(await res.text()).toBe('body{color:red}')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
  })

  it('serves no reload endpoint and injects nothing without a hub', async() => {
    const plain = http.createServer(createStaticHandler(baseDir))
    await new Promise((resolve) => plain.listen(0, resolve))
    const plainOrigin = `http://localhost:${plain.address().port}`
    try {
      expect((await fetch(`${plainOrigin}${RELOAD_PATH}`)).status).toBe(404)
      expect(await (await fetch(`${plainOrigin}/`)).text()).toBe('<html><body><h1>home</h1></body></html>')
    } finally {
      await new Promise((resolve) => plain.close(resolve))
    }
  })
})
