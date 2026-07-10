import { Marked } from 'marked'
import { slugify } from 'book-of-spells'
import { highlightRenderer, highlightCode } from './highlight.js'
import { decodeTemplateEntities } from './helpers.js'

// The marked renderer used across the markup engines: syntax highlighting
// (from highlight.js) plus heading slug ids + permalink anchors.
export const markdownRenderer = {
  ...highlightRenderer,
  // Give every heading a slug id + a permalink anchor. The anchor is empty on
  // purpose — themes reveal a "#" via `.heading-anchor::before`, so a site with
  // no such CSS renders an invisible anchor instead of a stray "#".
  // ponytail: no slug dedup — two identical headings on one page share an id;
  // add a per-parse counter if that ever bites.
  heading(text, level, raw) {
    const id = slugify(raw || '')
    if (!id) return `<h${level}>${text}</h${level}>\n`
    return `<h${level} id="${id}">${text}<a class="heading-anchor" href="#${id}" aria-label="Permalink" aria-hidden="true"></a></h${level}>\n`
  }
}

// One shared instance so both engines render markdown identically.
export const marked = new Marked({ renderer: markdownRenderer })

const RAW_BLOCK_RE = /\{%-?\s*raw\s*-?%\}([\s\S]*?)\{%-?\s*endraw\s*-?%\}/g

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Renders a markdown page source for the template engines. {% raw %} blocks
// must reach the template engine verbatim, but highlight.js wraps `{`/`%` in
// spans — splitting the tag so the engine never sees it and evaluates the
// "raw" content (e.g. a {{ name }} inside a code fence rendered as empty).
// So: swap raw blocks for placeholder tokens before marked runs, then splice
// them back with the inner text HTML-escaped (they overwhelmingly live inside
// <pre><code>, where escaped entities are exactly what display needs).
// ponytail: raw blocks wrapping *prose markdown* stay unrendered — none exist
// in practice; extract-per-context if that ever changes.
export function renderMarkdown(source) {
  const rawBlocks = []
  const tokenized = source.replace(RAW_BLOCK_RE, (block) => {
    rawBlocks.push(block)
    return `POOPSRAWBLOCK${rawBlocks.length - 1}X`
  })
  const html = decodeTemplateEntities(marked.parse(tokenized))
  return html.replace(/POOPSRAWBLOCK(\d+)X/g, (match, i) => {
    const block = rawBlocks[Number(i)]
    if (block === undefined) return match
    RAW_BLOCK_RE.lastIndex = 0
    // Multi-line raw blocks live in code fences: auto-highlight them (hljs
    // escapes too), matching what highlighting did before the swap. Single-line
    // ones sit in inline code or prose — escape only, no highlight spans.
    return block.replace(RAW_BLOCK_RE, (_, inner) =>
      `{% raw %}${inner.includes('\n') ? highlightCode(inner) : escapeHtml(inner)}{% endraw %}`)
  })
}
