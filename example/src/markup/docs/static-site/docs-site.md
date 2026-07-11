---
layout: docs
title: Building a documentation site
navTitle: A documentation site
description: Build a docs site with a left sidebar nav tree, search, and admonitions — exactly how this site is built.
order: 3
keywords: ["documentation", "docs", "sidebar", "navigation", "nav tree", "search", "admonitions"]
---

# Building a documentation site

You are reading one. This site is a plain Poops build — the left sidebar, the search box, the code
copy buttons and the coloured callouts all come from the `markup` pipeline plus a little CSS and
vanilla JS. Here is how to build your own.

## The navigation tree

Add `nav` to the markup config and Poops builds a nested navigation tree from your pages' front
matter and URL structure — `guide/index.md` becomes a parent node; `guide/getting-started.md`
becomes its child.

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "nav": { "output": "nav.json", "collections": "index", "home": true },
    "searchIndex": "search-index.json",
    "sitemap": "sitemap.xml"
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

The tree is arbitrarily deep, so render it with a self-recursing macro. Prefix each `url` with
`relativePathPrefix` so links resolve from any depth:

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
inside the callout still works.

## Copy buttons on code

Another few lines of JS wrap every `<pre>` and inject a **Copy** button that calls
`navigator.clipboard.writeText`. No build step, no dependency — it runs on the rendered output.

## Search

`searchIndex` writes a `search-index.json` — every page's front matter plus auto-extracted
keywords. A small client script fetches it and filters by title/description/keywords as you type.
That is the search box at the top of this page.

> [!INFO]
> The search index strips internal fields (`content`, `layout`, …) and, per page, keeps up to
> `maxKeywords` keywords. Provide your own `keywords` array in front matter to override the
> auto-extracted ones.

## The result

Three config keys (`nav`, `searchIndex`, `sitemap`), a recursive macro, and a sprinkle of
vanilla JS — that is a complete docs site. No separate documentation framework required.

Next: [A blog with collections](blog-collections).
