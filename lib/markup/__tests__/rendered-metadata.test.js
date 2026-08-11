import { it, describe, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import Markups from '../../markups.js'

// Metadata a reader never sees — og:description, JSON-LD, heading ids — is
// derived from the page body, and the body only becomes text after the template
// engine runs. These are the end-to-end guarantees that it is derived from what
// the reader gets rather than from the markdown source: a full compile in and a
// written file out.
//
// Not covered here: the shape of each meta tag (helpers.test.js owns
// buildOpenGraph/buildJsonLd), and the pending-heading mechanics themselves
// (helpers.test.js and renderer.test.js own those). This file only cares that
// the two meet correctly on a real page.

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rendered-metadata-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const rel = (p) => path.relative(process.cwd(), p)

const SITE = {
  title: 'Repro Site',
  description: 'Real description from package.json.',
  url: 'https://example.com',
  lang: 'en'
}

function build(files, options = {}) {
  const src = path.join(tmpDir, 'src')
  const dist = path.join(tmpDir, 'dist')
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(src, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  fs.mkdirSync(dist, { recursive: true })

  const markups = new Markups({
    markup: {
      in: rel(src),
      out: rel(dist),
      options: { site: SITE, includePaths: ['_layouts', '_partials'], ...options }
    }
  })
  return markups.compile().then(() => ({
    read: (name) => fs.readFileSync(path.join(dist, name), 'utf-8')
  }))
}

const NUNJUCKS_LAYOUT = [
  '<!doctype html>',
  '<html><head>{{ page | description(site) }}{{ page | og(site) }}</head>',
  '<body>{% set body %}{% block content %}{% endblock %}{% endset %}',
  '<div class="toc-slot">{{ body | toc }}</div>',
  '{{ body }}</body></html>'
].join('\n')

describe('page metadata is derived from what the reader gets', () => {
  it('describes the page with the resolved paragraph, not the tag that produced it', async() => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      'index.md': '---\nlayout: default\n---\n\n# {{ site.title }}\n\n{{ site.description }}\n'
    })

    const html = read('index.html')
    expect(html).toContain('<meta property="og:description" content="Real description from package.json.">')
    expect(html).not.toContain('content="site.description"')
  })

  // The paragraph that describes the page can live in a partial — resolving the
  // tag means running the include, not deleting it.
  it('reaches through an include for the paragraph', async() => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      '_partials/tagline.html': '<p>{{ site.description }}</p>',
      'index.html': '---\nlayout: default\n---\n{% include "tagline.html" %}\n<p>Later prose.</p>'
    })

    expect(read('index.html')).toContain('<meta property="og:description" content="Real description from package.json.">')
  })

  it('leaves a page whose first paragraph is already prose alone', async() => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      'plain.md': '---\nlayout: default\n---\n\n# Plain Heading\n\nPlain prose paragraph with no template tags.\n'
    })

    const html = read('plain.html')
    expect(html).toContain('<meta property="og:description" content="Plain prose paragraph with no template tags.">')
    expect(html).toContain('<h1 id="plain-heading">')
  })

  it('falls back to site.description when the body resolves to nothing describable', async() => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      'empty.md': '---\nlayout: default\n---\n\n{{ page.missing }}\n'
    })

    expect(read('empty.html')).toContain('<meta property="og:description" content="Real description from package.json.">')
  })

  it('front matter still outranks the body', async() => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      'index.md': '---\nlayout: default\ndescription: Written by hand.\n---\n\nPlain prose paragraph.\n'
    })

    expect(read('index.html')).toContain('<meta property="og:description" content="Written by hand.">')
  })

  // The two tags describe the page from the same chain, so they cannot disagree
  // — and neither of them may be broken by prose. A layout writing the meta tag
  // by hand shipped `content="A "` for this description.
  it('the meta tag and og agree, and a quoted description breaks neither', async() => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      'index.md': '---\nlayout: default\ndescription: A "last updated" line & more.\n---\n\nProse.\n'
    })

    const html = read('index.html')
    expect(html).toContain('<meta name="description" content="A &quot;last updated&quot; line &amp; more.">')
    expect(html).toContain('<meta property="og:description" content="A &quot;last updated&quot; line &amp; more.">')
  })
})

describe('heading anchors are minted from the rendered heading', () => {
  // All three write the same words on the page, so all three have to anchor at
  // the same place: swapping which variable feeds a heading is invisible to a
  // reader and must not remint their bookmark.
  it.each([
    ['# {{ site.title }}', 'a site token'],
    ['# {{ page.title }}', 'a page token'],
    ['# Repro Site', 'plain text']
  ])('slugs %s (%s) to the same id', async(heading) => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      'index.md': `---\nlayout: default\ntitle: Repro Site\n---\n\n${heading}\n\nProse.\n`
    })

    const html = read('index.html')
    expect(html).toContain('<h1 id="repro-site">Repro Site<a class="heading-anchor" href="#repro-site"')
    expect(html).not.toContain('data-poops-heading')
  })

  it('gives the TOC the same id the heading ends up with', async() => {
    const { read } = await build({
      '_layouts/default.html': NUNJUCKS_LAYOUT,
      'index.md': '---\nlayout: default\n---\n\n## {{ site.title }}\n\nProse.\n'
    })

    const html = read('index.html')
    expect(html).toContain('<h2 id="repro-site">')
    expect(html).toContain('<a href="#repro-site">Repro Site</a>')
  })
})

describe('the liquid engine gets the same treatment', () => {
  it('resolves the excerpt and the heading id', async() => {
    const { read } = await build({
      '_layouts/default.liquid': [
        '<!doctype html>',
        '<html><head>{{ page | description: site }}{{ page | og: site }}</head>',
        '<body>{% block content %}{% endblock %}</body></html>'
      ].join('\n'),
      'index.md': '---\nlayout: default\n---\n\n# {{ site.title }}\n\n{{ site.description }}\n'
    }, { engine: 'liquid' })

    const html = read('index.html')
    expect(html).toContain('<meta name="description" content="Real description from package.json.">')
    expect(html).toContain('<meta property="og:description" content="Real description from package.json.">')
    expect(html).toContain('<h1 id="repro-site">')
  })
})
