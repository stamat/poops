import hljs from 'highlight.js/lib/core'
import { slugify } from 'book-of-spells'

import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import shell from 'highlight.js/lib/languages/shell'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import php from 'highlight.js/lib/languages/php'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import sql from 'highlight.js/lib/languages/sql'
import diff from 'highlight.js/lib/languages/diff'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('css', css)
hljs.registerLanguage('scss', scss)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', shell)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('rb', ruby)
hljs.registerLanguage('php', php)
hljs.registerLanguage('java', java)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('cs', csharp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('rs', rust)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('diff', diff)

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function highlightCode(code, language) {
  if (language) {
    const lang = language.toLowerCase().trim()
    if (hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
  }
  return hljs.highlightAuto(code).value
}

export const highlightRenderer = {
  code(code, lang) {
    const highlighted = highlightCode(code, lang)
    const langClass = lang ? ` language-${escapeHtml(lang)}` : ''
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
