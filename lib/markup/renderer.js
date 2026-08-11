import { Marked } from 'marked'
import { markedGithubEmoji } from 'marked-github-emoji'
import { markedGithubAlerts } from 'marked-github-alerts'
import { markedGithubFootnote } from 'marked-github-footnote'
import path from 'node:path'
import { slugify } from 'book-of-spells'
import { highlightRenderer, highlightCode, codeBlock } from './highlight.js'
import { decodeTemplateEntities, hasTemplateTags, headingHtml, PENDING_HEADING_ATTR } from './helpers.js'

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
  code({ text, lang }) {
    const highlighted = mapRawSegments(text, (s) => s && highlightCode(s, lang), (s) => highlightCode(s, lang))
    return `${codeBlock(highlighted, lang)}\n`
  },
  // Give every heading a slug id + a permalink anchor (see headingHtml for why
  // the anchor looks the way it does).
  //
  // A heading whose source carries a template tag is left for applyHeadingSlugs:
  // the engine has not run here, so both `raw` and `text` still read
  // `{{ site.title }}` and the id would come out of the syntax rather than the
  // content.
  //
  // ponytail: no slug dedup — two identical headings on one page share an id;
  // add a per-parse counter if that ever bites.
  heading({ tokens, depth, text: raw }) {
    const text = this.parser.parseInline(tokens)
    if (hasTemplateTags(raw)) return `<h${depth} ${PENDING_HEADING_ATTR}>${text}</h${depth}>\n`
    return `${headingHtml(depth, text, slugify(raw || ''))}\n`
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
marked.use(markedGithubFootnote())

// Renders a markdown page source for the template engines. Entity decoding
// (which un-escapes inside {{ }} / {% %} so template args parse) must skip
// raw blocks — their content is for display, so its entities have to survive
// to the browser.
export function renderMarkdown(source) {
  return mapRawSegments(marked.parse(source), decodeTemplateEntities, (s) => s)
}

// marked is a measurable slice of a build and its output only changes when
// the file does. Keyed by path, validated by content identity: parseFrontMatter
// hands back the same cached string object until the file's mtime changes, so
// a === check invalidates exactly when the source was actually re-read.
// The key is resolved because callers reach the same file by different names —
// the compiler holds the glob's relative path, the nunjucks loader an absolute
// one — and an unresolved key would parse the page a second time per build.
const markdownCache = new Map()
export function renderMarkdownCached(filePath, source) {
  const key = path.resolve(filePath)
  const cached = markdownCache.get(key)
  if (cached && cached.source === source) return cached.html
  const html = renderMarkdown(source)
  markdownCache.set(key, { source, html })
  return html
}
