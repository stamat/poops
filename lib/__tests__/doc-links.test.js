// Covers: that every in-repo link in the documentation resolves — the `#anchor`
// links against the headings actually present, and the relative links against
// files actually on disk. Two sluggers, because two renderers: README.md is
// rendered by GitHub, the pages under example/src/markup by Poops itself
// (lib/markup/renderer.js runs heading text through book-of-spells' slugify).
// Testing README with Poops' slugger would pass links GitHub 404s, and vice
// versa.
//
// Deliberately not covered: external URLs — checking them needs the network and
// fails on someone else's outage, not on our change. Anchors *into* another file
// (`page#section`) are checked as far as the file; the fragment is not resolved.
// Duplicate headings are not checked either — the renderer does no slug dedup
// (see its `ponytail:` note), so a second identical heading silently shares the
// first one's id, and the link still lands somewhere reasonable.

import { it, describe, expect } from '@jest/globals'
import { slugify } from 'book-of-spells'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
const SITE = path.join(ROOT, 'example', 'src', 'markup')

// GitHub's heading slugger: lowercase, drop everything that is not a word
// character, space or hyphen, then one hyphen per space — the doubled hyphen in
// `collections--pagination` is what a stripped `&` leaves behind.
const githubSlug = (text) =>
  text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-')

// Links inside code are samples, not links — `[title](url)` documenting llms.txt
// output is the case that matters. Fences first, then inline spans.
const stripCode = (md) => md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')

const headingAnchors = (md, slug) => {
  const anchors = new Set()
  for (const [, text] of md.matchAll(/^#{1,6}[ \t]+(.+)$/gm)) {
    anchors.add(slug(text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`/g, '').trim()))
  }
  return anchors
}

const links = (md) => [...stripCode(md).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1])

const mdFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return mdFiles(full)
    return entry.name.endsWith('.md') ? [full] : []
  })

const brokenAnchors = (file, slug) => {
  const md = fs.readFileSync(file, 'utf-8')
  const anchors = headingAnchors(md, slug)
  return links(md).filter((href) => href.startsWith('#') && !anchors.has(href.slice(1)))
}

describe('README.md', () => {
  const md = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8')

  it('has a table of contents and cross-references that land on headings GitHub actually renders', () => {
    expect(brokenAnchors(path.join(ROOT, 'README.md'), githubSlug)).toEqual([])
  })

  it('points at files that exist, so a moved sample or docs page is caught here rather than by a reader', () => {
    const missing = links(md)
      .filter((href) => !/^(https?:|mailto:|#)/.test(href))
      .map((href) => href.split('#')[0])
      .filter((rel) => rel && !fs.existsSync(path.join(ROOT, rel)))
    expect(missing).toEqual([])
  })

  // README is not built by Poops — GitHub renders it, and prints a raw wrapper
  // as the literal characters it is. `{% endraw %}` is the tell: a lone
  // `{% raw %}` in a code span is the tag being named, which is legitimate.
  it('carries no {% raw %} wrappers, which GitHub prints as the literal text they are', () => {
    expect(md).not.toContain('{% endraw %}')
  })
})

describe('the documentation site', () => {
  const pages = mdFiles(SITE)

  // A page's links resolve from its own directory. Poops writes `about.md` to
  // `about.html` and `dir/index.md` to `dir/`, and both the dev server and
  // GitHub Pages serve `/a/b` from `a/b.html` — so a bare, extensionless href
  // is the house style and all three shapes have to be accepted here.
  const resolves = (from, href) => {
    const target = path.resolve(path.dirname(from), href)
    return fs.existsSync(target) ||
      fs.existsSync(`${target}.md`) ||
      fs.existsSync(`${target}.html`) ||
      fs.existsSync(path.join(target, 'index.md')) ||
      fs.existsSync(path.join(target, 'index.html'))
  }

  it('links between its own pages without walking out of the site, the mistake a `../` from a top-level page makes', () => {
    const broken = pages.flatMap((file) =>
      links(fs.readFileSync(file, 'utf-8'))
        .filter((href) => !/^(https?:|mailto:|#|\/)/.test(href))
        // A page links to its own build artifacts too — llms-full.txt,
        // sitemap.xml, nav.json. Those exist only after a build, so only page
        // links (extensionless, .md or .html) are resolvable from sources.
        .filter((href) => !/\.[a-z0-9]+$/i.test(href.split('#')[0]) || /\.(md|html)$/i.test(href.split('#')[0]))
        .filter((href) => !resolves(file, href.split('#')[0]))
        .map((href) => `${path.relative(ROOT, file)} → ${href}`)
    )
    expect(broken).toEqual([])
  })

  it('anchors onto headings as Poops slugs them, not as some other renderer would', () => {
    const broken = pages.flatMap((file) =>
      brokenAnchors(file, slugify).map((href) => `${path.relative(ROOT, file)} → ${href}`)
    )
    expect(broken).toEqual([])
  })
})
