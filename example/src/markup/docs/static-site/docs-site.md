---
layout: poops-docs-theme/docs
title: Building a documentation site
navTitle: A documentation site
description: Build a docs site with a left sidebar nav tree, search, and admonitions — with the poops-docs-theme package, or with chrome you write yourself.
order: 3
keywords: ["documentation", "docs", "theme", "poops-docs-theme", "sidebar", "navigation", "nav tree", "search", "admonitions"]
---

# Building a documentation site

You are reading one. The topbar, the left sidebar, the search box, the copy buttons on the code
and the coloured callouts are [`poops-docs-theme`](https://www.npmjs.com/package/poops-docs-theme)
— a layout, a stylesheet and a script this site pulls out of `node_modules`. Underneath it is a
plain Poops build: the theme reads the same `nav` tree and `search-index.json` that any Poops site
can generate, so nothing it does is closed to you.

Two routes, and the second is not a consolation prize:

| | The theme | Chrome you write |
| --- | --- | --- |
| You write | a front-matter line and two config keys | a layout, a recursive macro, some CSS and JS |
| You get | topbar, sidebar, search, TOC, breadcrumb, dark mode, copy buttons, edit link | exactly what you built, nothing else |
| The design is | the theme's — tokens are overridable, the markup is not | yours |
| It costs | one devDependency, and living with its opinions | an afternoon, and then maintaining it |

The theme comes first below, then the pieces underneath it — which is also the order you want if
you are writing your own, because the tree and the index are the same either way.

## The theme route

**1. Install it.** It peer-depends on Poops **≥ 2.0.0**.

```bash
npm install --save-dev poops-docs-theme
```

**2. Point your pages at the layout** in front matter:

```yaml
---
layout: poops-docs-theme/docs
---
```

`poops-docs-theme/prose` is the other one: the same topbar, one article, no sidebar and no search
— for a one-page project. Pick one per page; the two bundles are alternatives, not layers, and
loading both means loading everything twice.

**3. Compile its stylesheet and script** into your output. The layout links `css/docs.min.css`
and `js/docs.min.js`, so those are the names to land on:

```json
{
  "styles": [{
    "in": "node_modules/poops-docs-theme/scss/docs.scss",
    "out": "dist/css/docs.css",
    "options": { "minify": true, "justMinified": true }
  }],
  "scripts": [{
    "in": "node_modules/poops-docs-theme/src/docs.ts",
    "out": "dist/js/docs.js",
    "options": { "minify": true, "justMinified": true, "format": "iife" }
  }]
}
```

`justMinified` drops the unminified twin, so `docs.css` is emitted as `docs.min.css` and nothing
beside it. Swap in `scss/prose-only.scss` and `src/prose.ts` for the prose layout. To skip
compiling altogether, `copy` the theme's own `dist/css` and `dist/js` — it ships both built.

**4. Generate what the layout reads.** The sidebar is the `nav` tree and the search box is
`search-index.json`. Both are markup options, and without them the layout renders a docs site
with no navigation and a search field that finds nothing:

```json
"markup": {
  "options": {
    "nav": { "out": "nav.json", "root": "docs", "collections": "index" },
    "searchIndex": "search-index.json"
  }
}
```

### The topbar

Everything in the bar comes out of `site`:

```json
"markup": {
  "options": {
    "site": {
      "brand": "Poops",
      "brandMark": "💩",
      "repo": "https://github.com/stamat/poops",
      "branch": "main",
      "links": [{ "title": "Changelog", "url": "changelog" }],
      "iconLinks": [
        { "title": "npm", "url": "https://www.npmjs.com/package/poops", "icon": "npm" }
      ]
    }
  }
}
```

| Key | What it puts in the bar |
| --- | --- |
| `brand` | the title, falling back to `site.title`. Links to the site root, or to `brandUrl`. |
| `brandMark` | the emoji beside it — also the tab icon, drawn inline, so there is no favicon file to make. |
| `repo` | the GitHub button, and with `branch` the edit link at the foot of each page. Falls back to `package.homepage`; omit both and the button disappears. |
| `links` | labelled nav links. Site-relative urls get the page's path prefix, absolute ones open in a new tab, and the section you are in is marked with `aria-current` rather than hidden. |
| `iconLinks` | the same list without labels — a package registry, a chat room. `title` becomes the `aria-label`. |
| `footer` | html, unescaped, replacing the default brand/version/license line. |
| `theme` | pins light or dark and drops the switch. |

Both lists take an `icon`: `github`, `npm` and `package` draw built-in marks, and anything else is
printed as given, so an emoji or a pasted `<svg>` works too.

The links row measures itself rather than folding at a width someone typed — a link that stops
fitting moves into a **More** panel, and when the window is under 40rem the whole row becomes a
drawer. The sidebar does the same at 60rem. Neither is modal: `Tab` reaches every link and Escape
closes what is open. The rest of the theme's config — pinning the colour scheme, overriding the
tokens, embedding live samples — is in
[its README](https://github.com/stamat/poops-docs-theme#readme).

### Typing the pages

The `jsonld` filter types a dateless page as `WebPage`. Documentation is `TechArticle`, and it is
one setting for the whole site rather than a line in every page's front matter:

```json
"markup": { "options": { "site": { "jsonld": { "@type": "TechArticle" } } } }
```

## The navigation tree

Both routes need this one. Add `nav` to the markup config and Poops builds a nested navigation
tree from your pages' front matter and URL structure — `guide/index.md` becomes a parent node;
`guide/getting-started.md` becomes its child.

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "nav": { "out": "nav.json", "collections": "index", "home": true },
      "searchIndex": "search-index.json",
      "sitemap": "sitemap.xml"
    }
  }
}
```

The tree is exposed two ways:

- as the **`nav` global** on every page (built in a pre-pass, always current),
- and as **`nav.json`** for client-side rendering.

> [!TIP]
> Render the sidebar from the `nav` global, not from `nav.json` loaded via `data`. The global
> always reflects the current build; the loaded file would be one build behind.

### Front matter that shapes the tree

| Field | Effect |
| --- | --- |
| `order` | Number that sorts a page among its siblings. Unordered pages fall to the bottom, alphabetically. |
| `navTitle` | Sidebar label that overrides `title`. |
| `nav: false` | Hide the page from the sidebar (still indexed and in the sitemap). |

So a hand-authored sequence wins over alphabetical: give your intro `order: 0`, the next section
`order: 1`, and so on.

## Rendering the sidebar

The theme does this for you. Writing your own: the tree is arbitrarily deep, so render it with a
self-recursing macro, and prefix each `url` with `relativePathPrefix` so links resolve from any
depth:

```nunjucks
{% raw %}{% macro navtree(items) %}
<ul>
  {% for item in items %}
  <li>
    {% if item.url != null %}
      <a href="{{ relativePathPrefix }}{{ item.url }}">{{ item.title }}</a>
    {% else %}
      <span>{{ item.title }}</span>
    {% endif %}
    {% if item.children %}{{ navtree(item.children) }}{% endif %}
  </li>
  {% endfor %}
</ul>
{% endmacro %}

{{ navtree(nav) }}{% endraw %}
```

> [!WARNING]
> Use `item.url != null`, not `if item.url`. The homepage node's `url` is an empty string — a
> valid link — while synthesized section nodes have no `url` at all. A plain truthiness check
> wrongly demotes the homepage to a `<span>`.

## Admonitions (info / tip / warning)

Poops parses GitHub-style alert blockquotes during markdown render (via
`marked-github-alerts`). Author them as:

```markdown
> [!TIP]
> This becomes a green "Tip" callout. Markdown **inside** it still renders.

> [!WARNING]
> A red "Warning" callout.

> [!INFO]
> A blue "Info" callout.
```

They render as alert `<div>` blocks with type classes (`-tip`, `-warning`, etc.), so markdown
inside the callout still works. The theme styles all five flavours already. Without it, include
the default styles once:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/marked-github-alerts/styles.css">
```

## Copy buttons on code

The theme's script does this. Otherwise it is another few lines of JS: wrap every `<pre>` and
inject a **Copy** button that calls `navigator.clipboard.writeText`. No build step, no dependency
— it runs on the rendered output.

## Search

`searchIndex` writes a `search-index.json` — every page's front matter plus auto-extracted
keywords. The theme's script fetches it and filters by title/description/keywords as you type;
that is the search box at the top of this page. On your own chrome the index is the same file and
the filtering is yours to write.

> [!INFO]
> The search index strips internal fields (`content`, `layout`, …) and, per page, keeps up to
> `maxKeywords` keywords. Provide your own `keywords` array in front matter to override the
> auto-extracted ones.

## "Edit this page on GitHub"

Every page carries `page.filePath` — its source file path relative to your project root, with
posix separators (e.g. `src/markup/docs/index.md`). That is exactly the path GitHub's editor
expects, so an edit link is one line in your layout — and it is the line the theme already writes
from `site.repo` and `site.branch`:

```nunjucks
{% raw %}{% set repoUrl = site.repo or package.homepage %}
{% if page.filePath and repoUrl %}
<a href="{{ repoUrl }}/edit/{{ site.branch or 'main' }}/{{ page.filePath }}">✏️ Edit this page on GitHub</a>
{% endif %}{% endraw %}
```

Set the repo and branch in your `site` data (or let it fall back to `package.homepage` and `main`):

```json
{
  "markup": {
    "options": {
      "site": { "repo": "https://github.com/you/your-repo", "branch": "main" }
    }
  }
}
```

Don't reconstruct the path from `page.url` — that is the output URL (`.html`, and `index.md`
collapses to a directory), so it can't be reversed to the `.md` source. Use `page.filePath`.

## The result

Two config keys and a line of front matter, if the theme's design suits you. The same two keys,
a recursive macro and a sprinkle of vanilla JS, if it does not. No separate documentation
framework either way: the tree, the index and the sitemap belong to the `markup` pipeline, and
the chrome around them is a choice.

Next: [A blog with collections](blog-collections).
