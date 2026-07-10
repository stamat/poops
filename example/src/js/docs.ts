// Poops docs client. Vanilla, no deps — bundled to IIFE by poops.

type Kind = { cls: string; icon: string; label: string }

const ADMONITIONS: Record<string, Kind> = {
  NOTE: { cls: 'note', icon: '✎', label: 'Note' },
  INFO: { cls: 'info', icon: 'ℹ', label: 'Info' },
  IMPORTANT: { cls: 'info', icon: 'ℹ', label: 'Important' },
  TIP: { cls: 'tip', icon: '💡', label: 'Tip' },
  WARNING: { cls: 'warning', icon: '⚠', label: 'Warning' },
  CAUTION: { cls: 'warning', icon: '⚠', label: 'Caution' }
}

// Turn GitHub-style `> [!TIP]` blockquotes into styled admonitions.
function upgradeAdmonitions(): void {
  document.querySelectorAll<HTMLElement>('.prose blockquote').forEach((bq) => {
    const first = bq.firstElementChild as HTMLElement | null
    if (!first) return
    const m = first.innerHTML.match(/^\s*\[!(\w+)\]\s*(?:<br\s*\/?>)?\s*/i)
    if (!m) return
    const kind = ADMONITIONS[m[1].toUpperCase()]
    if (!kind) return
    first.innerHTML = first.innerHTML.slice(m[0].length)
    if (!first.innerHTML.trim()) first.remove()
    bq.className = 'admonition ' + kind.cls
    const title = document.createElement('p')
    title.className = 'admonition-title'
    title.setAttribute('data-icon', kind.icon)
    title.textContent = kind.label
    bq.insertBefore(title, bq.firstChild)
  })
}

// Add a copy button to every code block.
function addCopyButtons(): void {
  document.querySelectorAll<HTMLPreElement>('.prose pre').forEach((pre) => {
    const wrap = document.createElement('div')
    wrap.className = 'code-wrap'
    pre.parentNode!.insertBefore(wrap, pre)
    wrap.appendChild(pre)
    const btn = document.createElement('button')
    btn.className = 'copy-btn'
    btn.type = 'button'
    btn.textContent = 'Copy'
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.innerText).then(() => {
        btn.textContent = 'Copied'
        btn.classList.add('copied')
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied') }, 1500)
      })
    })
    wrap.appendChild(btn)
  })
}

function setupTheme(): void {
  const btn = document.querySelector('[data-theme-toggle]')
  btn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('theme', next) } catch (e) { /* private mode */ }
  })
}

function setupMobileNav(): void {
  const sidebar = document.querySelector('[data-sidebar]')
  document.querySelector('[data-nav-toggle]')?.addEventListener('click', () => sidebar?.classList.toggle('open'))
  document.querySelector('[data-nav-close]')?.addEventListener('click', () => sidebar?.classList.remove('open'))
}

// Highlight the current page in the sidebar. Done client-side because the
// server-side page.url carries the output-dir prefix while nav urls don't.
function markActiveNav(): void {
  const norm = (p: string): string => (p.replace(/index\.html$/, '').replace(/\/$/, '') || '/')
  const here = norm(location.pathname)
  document.querySelectorAll<HTMLAnchorElement>('.sidebar a.nav-link').forEach((a) => {
    if (norm(new URL(a.href).pathname) === here) {
      a.classList.add('active')
      a.scrollIntoView({ block: 'center' })
    }
  })
}

interface Entry { title: string; description?: string; url: string; keywords?: string[] }

function setupSearch(base: string): void {
  const input = document.getElementById('search-input') as HTMLInputElement | null
  const box = document.getElementById('search-results')
  if (!input || !box) return
  let index: Entry[] = []
  fetch(base + 'search-index.json').then((r) => r.json()).then((d) => { index = d }).catch(() => {})

  const render = (q: string): void => {
    const query = q.trim().toLowerCase()
    if (!query) { box.hidden = true; box.innerHTML = ''; return }
    const hits = index.filter((e) => {
      const hay = (e.title + ' ' + (e.description || '') + ' ' + (e.keywords || []).join(' ')).toLowerCase()
      return hay.includes(query)
    }).slice(0, 8)
    box.hidden = false
    if (!hits.length) { box.innerHTML = '<div class="sr-empty">No results</div>'; return }
    box.innerHTML = hits.map((e) =>
      `<a href="${base}${e.url}"><span class="sr-title">${e.title}</span>` +
      (e.description ? `<span class="sr-desc">${e.description}</span>` : '') + '</a>'
    ).join('')
  }
  input.addEventListener('input', () => render(input.value))
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.search')) box.hidden = true
  })
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; box.hidden = true } })
}

const BASE = (document.currentScript as HTMLScriptElement | null)?.dataset.base ?? ''

function boot(): void {
  const base = BASE
  markActiveNav()
  upgradeAdmonitions()
  addCopyButtons()
  setupTheme()
  setupMobileNav()
  setupSearch(base)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
else boot()
