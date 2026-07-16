---
layout: docs
title: Build a Static Site
navTitle: Build a Static Site
description: Use Poops as a Jekyll-inspired static site generator — pages, images, docs, blogs and React, all from one config.
order: 3
keywords: ["static site", "ssg", "jekyll", "pages", "blog", "docs"]
---

# Build a Static Site

This is where Poops stops being "just a bundler." The `markup` pipeline is a full static site
generator: templates, front matter, collections, pagination, an image tag, a search index, a
sitemap and a navigation tree — all generated in a single pass.

A typical static-site project looks like this:

```text
my-site/
├─ poops.json
├─ package.json
└─ src/
   ├─ scss/          → compiled to dist/css
   ├─ js/            → bundled to dist/js
   ├─ static/        → copied to dist
   └─ markup/
      ├─ _layouts/   → base templates (not emitted)
      ├─ _partials/  → includes (not emitted)
      ├─ _data/      → JSON/YAML globals
      ├─ index.md
      ├─ about.md
      └─ blog/
         ├─ index.html
         └─ first-post.md
```

A config that ties it together:

```json
{
  "styles": [
    {
      "in": "src/scss/index.scss",
      "out": "dist/css/styles.css",
      "options": { "minify": true }
    }
  ],
  "scripts": [
    {
      "in": "src/js/main.ts",
      "out": "dist/js/scripts.js",
      "options": { "minify": true }
    }
  ],
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "site": {
      "title": "My Site",
      "description": "Built with Poops.",
      "url": "https://example.com"
    },
    "includePaths": ["_layouts", "_partials"],
    "searchIndex": "search-index.json",
    "sitemap": "sitemap.xml",
    "nav": "nav.json"
  },
  "copy": [{ "in": "src/static", "out": "dist" }],
  "serve": { "port": 4040, "base": "/dist" },
  "livereload": true,
  "watch": ["src"]
}
```

> [!TIP]
> This very documentation site is built with Poops. The layout, sidebar, search box and code copy
> buttons you're using right now come out of exactly this pipeline — it's dogfooded.

Work through the pieces:

- [Building pages](pages) — layouts, partials, front matter, Markdown.
- [Images & galleries](images-gallery) — responsive images and a photo grid.
- [A documentation site](docs-site) — the sidebar nav tree, like this site.
- [A blog with collections](blog-collections) — posts, sorting, pagination, RSS.
- [React components](react-components) — pre-render components into pages.
- [A complete React static site](react-static-site) — a full hydrated SSG.

> [!INFO]
> Poops generates a **search index**, **sitemap** and **navigation tree** automatically when you
> add `searchIndex`, `sitemap` and `nav` to the markup config. All three come from your pages'
> front matter in one build pass.
