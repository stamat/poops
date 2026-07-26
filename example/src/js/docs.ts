// Poops docs client. Vanilla, no deps — bundled to IIFE by poops.

// Octicons: copy-16 and check-16.
const COPY_SVG = '<svg class="icon-copy" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>'
const CHECK_SVG = '<svg class="icon-check" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L1.72 8.78a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>'

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
    btn.setAttribute('aria-label', 'Copy code')
    btn.dataset.tip = 'Copied'
    btn.innerHTML = COPY_SVG + CHECK_SVG
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.innerText).then(() => {
        btn.classList.add('copied')
        setTimeout(() => btn.classList.remove('copied'), 1500)
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
  addCopyButtons()
  setupTheme()
  setupMobileNav()
  setupSearch(base)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
else boot()
