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

export function createStaticHandler(base) {
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

    res.setHeader('Content-Type', MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
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
