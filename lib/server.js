/* Minimal static file server replacing connect + serve-static.
   Supports single-range requests (in-browser video seeking, Safari playback).
   ponytail: no ETag/Cache-Control — dev server wants fresh responses, not 304s. */
import fs from 'node:fs'
import path from 'node:path'
import { pathExists } from './utils/helpers.js'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
}

// The reload channel. One endpoint on the static server, so a poops dev
// session is one port total.
export const RELOAD_PATH = '/__poops_reload'

// Injected into every served HTML page while livereload is on, so nothing has
// to be embedded in your templates. EventSource reconnects on its own, which
// is the whole reason this is SSE and not a socket: restart poops and the open
// tabs re-attach without a keepalive protocol of our own.
// CSS paths arrive as build-output paths ('dist/css/site.css') while the page
// links a URL ('/css/site.css'), so a stylesheet matches when the emitted path
// ends with the link's pathname — the same suffix match livereload did, and it
// survives any `serve.base`. Re-setting href with a cache-busting query swaps
// the stylesheet in place; the page never reloads and scroll/state survive.
// A css event that matches no link on the page falls back to a full reload:
// the build wrote a stylesheet this page does not link (or links under another
// name), and silently doing nothing would look like a dead watcher.
const RELOAD_CLIENT = `<script>
(function () {
  var es = new EventSource('${RELOAD_PATH}')
  es.addEventListener('reload', function () { location.reload() })
  es.addEventListener('css', function (e) {
    var paths = JSON.parse(e.data)
    var links = document.querySelectorAll('link[rel="stylesheet"][href]')
    var swapped = 0
    for (var i = 0; i < links.length; i++) {
      var pathname = new URL(links[i].href, location.href).pathname
      for (var j = 0; j < paths.length; j++) {
        if (paths[j].endsWith(pathname)) {
          links[i].href = pathname + '?poops=' + Date.now()
          swapped++
          break
        }
      }
    }
    if (!swapped) location.reload()
  })
})()
</script>
`

export function injectReloadClient(html) {
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, RELOAD_CLIENT + '</body>')
    : html + RELOAD_CLIENT
}

// Holds the open EventSource responses and fans build events out to them.
// Kept separate from the request handler so the watch loop can own one hub and
// hand it to the server, and so it can be driven directly in tests.
export function createReloadHub() {
  const clients = new Set()

  return {
    clients,

    handle(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      // Reconnect fast after a poops restart — the browser default is 3s
      res.write('retry: 1000\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
    },

    send(event, data) {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      for (const res of clients) res.write(payload)
    }
  }
}

// Parse a single-range `Range: bytes=start-end` header against a file size.
// Returns { start, end } (inclusive), null when absent/ignorable (multipart,
// malformed — RFC says serve the full file then), or 'unsatisfiable' for a
// well-formed range outside the file (→ 416).
export function parseRange(header, size) {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (match[1] === '' && match[2] === '')) return null

  let start, end
  if (match[1] === '') {
    // Suffix range: last N bytes
    const suffix = parseInt(match[2])
    if (suffix === 0) return 'unsatisfiable'
    start = Math.max(size - suffix, 0)
    end = size - 1
  } else {
    start = parseInt(match[1])
    end = match[2] === '' ? size - 1 : Math.min(parseInt(match[2]), size - 1)
  }

  if (start >= size || start > end) return 'unsatisfiable'
  return { start, end }
}

export function createStaticHandler(base, reloadHub) {
  // Drop any trailing separator — `serve.base: "/"` resolves to `<cwd>/`, and the
  // containment check below would then compare against `<cwd>//` and reject everything
  base = path.resolve(base)
  const notFoundPage = path.join(base, '404.html')

  const notFound = (res) => {
    res.statusCode = 404
    if (!pathExists(notFoundPage)) return res.end('Not Found')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // 404.html lives at the site root but is served at any depth — its relative
    // asset paths would resolve against /a/ for /a/b, so pin them with <base>
    let html
    try {
      html = fs.readFileSync(notFoundPage, 'utf8')
    } catch {
      return res.end('Not Found')
    }
    if (!/<base[\s>]/i.test(html)) html = html.replace(/<head([^>]*)>/i, '<head$1><base href="/">')
    if (reloadHub) html = injectReloadClient(html)
    res.end(html)
  }

  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Allow', 'GET, HEAD')
      return res.end('Method Not Allowed')
    }

    let url, pathname
    try {
      url = new URL(req.url, 'http://localhost')
      pathname = decodeURIComponent(url.pathname)
    } catch {
      res.statusCode = 400
      return res.end('Bad Request')
    }

    if (reloadHub && pathname === RELOAD_PATH) return reloadHub.handle(req, res)

    // Contain resolution inside `base` — rejects `..` traversal and null bytes
    if (pathname.includes('\0')) return notFound(res)
    let filePath = path.normalize(path.join(base, pathname))
    if (filePath !== base && !filePath.startsWith(base + path.sep)) return notFound(res)

    let stat
    try {
      stat = fs.statSync(filePath)
    } catch {
      // GitHub Pages-style extensionless URLs: /a/b serves a/b.html, URL unchanged
      try {
        stat = fs.statSync(filePath + '.html')
        filePath += '.html'
      } catch {
        return notFound(res)
      }
    }

    if (stat.isDirectory()) {
      // Redirect /dir → /dir/ so the page's relative URLs resolve correctly
      if (!pathname.endsWith('/')) {
        res.statusCode = 301
        res.setHeader('Location', encodeURI(pathname) + '/' + url.search)
        return res.end()
      }
      filePath = path.join(filePath, 'index.html')
      try {
        stat = fs.statSync(filePath)
      } catch {
        return notFound(res)
      }
    }

    const ext = path.extname(filePath).toLowerCase()
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')

    // HTML gets the reload client appended, so it's built in memory rather than
    // streamed — the length changes, and a Range over a page nobody seeks in
    // isn't worth keeping consistent with the injection.
    if (reloadHub && ext === '.html') {
      let html
      try {
        html = injectReloadClient(fs.readFileSync(filePath, 'utf8'))
      } catch {
        return notFound(res)
      }
      res.statusCode = 200
      res.setHeader('Content-Length', Buffer.byteLength(html))
      return res.end(req.method === 'HEAD' ? undefined : html)
    }

    res.setHeader('Accept-Ranges', 'bytes')

    const range = parseRange(req.headers.range, stat.size)
    if (range === 'unsatisfiable') {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${stat.size}`)
      return res.end()
    }

    const streamOpts = {}
    if (range) {
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
      res.setHeader('Content-Length', range.end - range.start + 1)
      streamOpts.start = range.start
      streamOpts.end = range.end
    } else {
      res.statusCode = 200
      res.setHeader('Content-Length', stat.size)
    }

    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(filePath, streamOpts).on('error', () => res.destroy()).pipe(res)
  }
}
