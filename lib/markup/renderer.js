import { Marked } from 'marked'
import { markedGithubEmoji } from 'marked-github-emoji'
import { markedGithubAlerts } from 'marked-github-alerts'
import { slugify } from 'book-of-spells'
import { highlightRenderer, highlightCode } from './highlight.js'
import { decodeTemplateEntities } from './helpers.js'

const RAW_BLOCK_RE = /\{%-?\s*raw\s*-?%\}([\s\S]*?)\{%-?\s*endraw\s*-?%\}/g

// Applies `outside` to the text between {% raw %} blocks and `inside` to each
// block's inner content, re-emitting the delimiters untouched so the template
// engine still sees them. The two places that would otherwise mangle raw
// content route through this: fence highlighting and entity decoding.
function mapRawSegments(str, outside, inside) {
  RAW_BLOCK_RE.lastIndex = 0
  let out = ''
  let last = 0
  for (const m of str.matchAll(RAW_BLOCK_RE)) {
    out += outside(str.slice(last, m.index))
    out += `{% raw %}${inside(m[1])}{% endraw %}`
    last = m.index + m[0].length
  }
  return out + outside(str.slice(last))
}

// The marked renderer used across the markup engines: syntax highlighting
// (from highlight.js) plus heading slug ids + permalink anchors.
export const markdownRenderer = {
  ...highlightRenderer,
  // Fenced code goes through hljs, which wraps `{`/`%` in their own spans —
  // splitting a {% raw %} tag so the template engine never sees it and
  // evaluates the "raw" content (e.g. a {{ name }} in a config sample rendered
  // as empty). Highlight around/inside each raw block instead, keeping the
  // fence's language, and pass the delimiters through intact. Inline code
  // never splits the delimiters, so it needs no special casing.
  code(code, lang) {
    const highlighted = mapRawSegments(code, (s) => s && highlightCode(s, lang), (s) => highlightCode(s, lang))
    const langClass = lang ? ` language-${lang.replace(/[^\w-]/g, '')}` : ''
    return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>\n`
  },
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
marked.use(markedGithubEmoji())
marked.use(markedGithubAlerts({
  alerts: {
    info: { title: 'Info', icon: 'info' }
  }
}))

// Renders a markdown page source for the template engines. Entity decoding
// (which un-escapes inside {{ }} / {% %} so template args parse) must skip
// raw blocks — their content is for display, so its entities have to survive
// to the browser.
export function renderMarkdown(source) {
  return mapRawSegments(marked.parse(source), decodeTemplateEntities, (s) => s)
}
