import { Marked } from 'marked'
import { slugify } from 'book-of-spells'
import { highlightRenderer } from './highlight.js'

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
