import hljs from 'highlight.js/lib/core'

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

// A fence's info string is everything after the backticks — the language plus
// any meta words (```html preview). Only the first word names the language, so
// the rest has to come off before a hljs lookup or a `language-` class: with it
// attached, getLanguage misses and the block silently falls to auto-detection.
export function fenceLang(info) {
  return String(info || '').trim().split(/\s+/)[0].toLowerCase()
}

// Everything after the language is the fence's own markup for a later stage:
// a bare word becomes a class (```html preview → code.preview), `key=value`
// becomes a data attribute (tab=options → data-tab="options"). Values are
// single tokens — no quotes, no spaces — which keeps the parser a split and is
// enough for settings; anything longer belongs in the markdown around the fence.
export function fenceAttrs(info) {
  const [lang, ...rest] = String(info || '').trim().split(/\s+/).filter(Boolean)
  const classes = ['hljs']
  if (lang) classes.push(`language-${lang.toLowerCase().replace(/[^\w-]/g, '')}`)
  let data = ''
  for (const token of rest) {
    const eq = token.indexOf('=')
    if (eq < 0) {
      const name = token.replace(/[^\w-]/g, '')
      if (name) classes.push(name)
      continue
    }
    const key = token.slice(0, eq).replace(/[^\w-]/g, '')
    if (key) data += ` data-${key}="${escapeHtml(token.slice(eq + 1))}"`
  }
  return ` class="${classes.join(' ')}"${data}`
}

// The one place a highlighted fence becomes html. Every renderer and engine
// goes through it, so they cannot drift on what a fence produces again.
export function codeBlock(highlighted, info) {
  return `<pre><code${fenceAttrs(info)}>${highlighted}</code></pre>`
}

export function highlightCode(code, language) {
  const lang = fenceLang(language)
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value
  }
  return hljs.highlightAuto(code).value
}

export const highlightRenderer = {
  code({ text, lang }) {
    return `${codeBlock(highlightCode(text, lang), lang)}\n`
  }
}
