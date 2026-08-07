---
layout: poops-docs-theme/docs
title: Migrating from Eleventy
navTitle: Migrate from Eleventy
description: Nunjucks templates port almost unchanged; the JavaScript config does not. Every Eleventy API mapped to a config key — and the four that have no key.
order: 9
keywords: ["eleventy", "11ty", "migration", "migrate", "nunjucks", "permalink", "collections", "shortcodes"]
---

# Migrating from Eleventy

If your Eleventy site is Nunjucks, the templates mostly move as they are — same syntax, same
`{% raw %}{% include %}{% endraw %}`, same filters where they overlap. What does not move is
`eleventy.config.js`, because Poops has no JavaScript config to move it into. That is the trade in
one sentence: **you lose the programmable build, you stop maintaining a bundler beside it.**

Read the four hard stops first.

| The thing | What happens | What you do |
| --- | --- | --- |
| **`permalink`** | Not supported, templated or otherwise. Output path mirrors source path | Put the files where the URLs go. `about/index.njk` → `dist/about/index.html` still works, because it is a real directory |
| **`addFilter` / `addShortcode`** | No API to register them | Use the [bundled filters and tags](config-reference), or move the logic into the template. A whole template language can be [a custom engine](engine-api); a single filter cannot |
| **`addCollection`** | Collections are directories, not queries | A collection is a direct subdirectory of `markup.in`. Cross-cutting queries — "everything tagged X across the site" — become [taxonomies within one collection](static-site/blog-collections), or they go |
| **`eleventyComputed`** | No computed data layer | Compute in the template, or put the value in front matter |

## Config, key by key

Everything in `eleventy.config.js` that has an equivalent:

| Eleventy | Poops |
| --- | --- |
| `dir.input` | `markup.in` |
| `dir.output` | `markup.out` |
| `dir.includes`, `dir.layouts` | `markup.options.includePaths` — an array, so `_layouts` and `_partials` can both be on it |
| `dir.data` + `_data/*.js` | `markup.options.data` — an explicit list of JSON/YAML files. **JavaScript data files have no equivalent** |
| `addPassthroughCopy("img")` | `"copy": [{ "in": "src/img", "out": "dist/img" }]` |
| `addGlobalData("site", …)` | `markup.options.site` |
| `setTemplateFormats` | fixed: `.html`, `.md`, and `.njk` or `.liquid` |
| `addPlugin(pluginRss)` | `markup.options.feed` |
| `addPlugin(EleventyHtmlBasePlugin)` | `{% raw %}{{ relativePathPrefix }}{% endraw %}` in templates, plus `baseURL` or `--base-url` when you [deploy under a subpath](deploying) |
| `eleventy-plugin-vite`, or your own bundler | `styles`, `scripts`, `postcss` — top-level keys in the same file |
| `addFilter`, `addShortcode`, `addTransform`, `addCollection` | **no equivalent** |

The whole thing, for a blog that was Eleventy plus Vite:

```json
{
  "markup": {
    "in": "src",
    "out": "dist",
    "options": {
      "engine": "nunjucks",
      "site": { "title": "My Site", "url": "https://example.com" },
      "includePaths": ["_layouts", "_partials"],
      "data": ["_data/site.json"],
      "sitemap": "sitemap.xml",
      "searchIndex": "search-index.json",
      "feed": { "collection": "blog", "out": "feed.rss" }
    }
  },
  "styles": [{ "in": "src/scss/index.scss", "out": "dist/css/styles.css", "options": { "minify": true } }],
  "scripts": [{ "in": "src/js/main.ts", "out": "dist/js/main.js", "options": { "minify": true, "format": "iife" } }],
  "copy": [{ "in": "src/img", "out": "dist/img" }],
  "watch": ["src"],
  "livereload": true
}
```

## Collections: queries become directories

This is the conceptual change, and it is worth understanding before you move files.

In Eleventy, `tags: post` in front matter puts a page into `collections.post` no matter where the
file lives. In Poops, **the directory is the collection** — every page under `src/blog/` is in the
`blog` collection, and the index file declares it:

```yaml
---
title: Blog
collection: true
paginate: 10
sort: date
taxonomies: [tags]
---
```

| Eleventy | Poops |
| --- | --- |
| `tags: post` in each file | put the file in `blog/`; the collection is automatic |
| `collections.post` in templates | `blog.items` — a global named after the directory |
| `collections.post` filtered by a second tag | `tags: [release]` in front matter + `taxonomies: [tags]` on the collection, which also builds `blog/tags/release/` as a real page |
| `addCollection` with a custom sort | `sort: date` or `sort: { by: "title", order: "asc" }` |
| `pagination: { data, size, alias }` in front matter | `paginate: 10` on the collection; the index template reads `blog.pageItems`, `blog.pageNumber`, `blog.totalPages` |
| `{% raw %}permalink: "page-{{ pagination.pageNumber }}/"{% endraw %}` | fixed shape: page 1 at `blog/`, page N at `blog/N/` |
| `{% raw %}{% for post in collections.post %}{% endraw %}` | `{% raw %}{% for post in blog.items %}{% endraw %}` |

A page whose front matter has `eleventyExcludeFromCollections: true` becomes `published: false` —
which also stops the page being built at all, so if you need the page but not the listing, move it
out of the collection directory instead.

## Templates

| Eleventy (Nunjucks) | Poops |
| --- | --- |
| `layout: base.njk` | `layout: base`, and the file is `_layouts/base.html` — the Nunjucks engine appends `.html` to the name, so layouts get renamed off `.njk` (Liquid appends `.liquid`). `theme/layout` resolves from `node_modules` |
| `{% raw %}{{ content \| safe }}{% endraw %}` in the layout | `{% raw %}{% block content %}{% endblock %}{% endraw %}` — the body is rendered into the block |
| `{% raw %}{% include "header.njk" %}{% endraw %}` | same |
| `{% raw %}{{ page.url }}{% endraw %}` | same, and `page.filePath`, `page.excerpt`, `page.wordcount` come free |
| `{% raw %}{{ post.data.title }}{% endraw %}` | `{% raw %}{{ post.title }}{% endraw %}` — items are flat, no `data` wrapper |
| `{% raw %}{{ "now" \| date: … }}{% endraw %}` via a plugin | `{% raw %}{{ post.date \| date("MMM D, YYYY") }}{% endraw %}` — [dayjs](https://day.js.org/) tokens, with a `dateFormat` default |
| A shortcode you wrote for images | the `{% raw %}{% image %}{% endraw %}` tag, with [`poops-images`](static-site/images-gallery) doing the resizing |
| A shortcode for code samples | `{% raw %}{% highlight 'javascript' %}{% endraw %}`, or a Markdown fence — both highlighted at build time |
| `eleventy-plugin-syntaxhighlight` | nothing to install; it is on by default |

## The order that works

1. **Point `markup.in` at your existing `dir.input`.** Underscore directories are ignored for
   output already, so `_layouts` and `_includes` keep working once they are on `includePaths`.
   Rename layout files from `.njk` to `.html` and drop the extension from the `layout:` line.
2. **Move tagged posts into a directory** named for the collection, and put `collection: true` in
   its index file.
3. **Delete every `permalink`** and move the file to match the URL it declared.
4. **Replace `collections.x` with `x.items`** and drop `.data` from item property access.
5. **Port shortcodes and filters** to bundled tags, or inline them. This is the step that decides
   whether the migration is an hour or a weekend — count them before you start.
6. **Move the bundler config into `scripts`/`styles`** and delete the Vite config, the
   `npm-run-all` script and the second watcher.
7. **`poops -b`, then read the warnings.** Missing `date:` front matter is the common one.

> [!NOTE]
> This is a mapping, not a script. Nothing here was run against an existing Eleventy site — the
> Poops side of every row is documented behaviour, the Eleventy side is from
> [its docs](https://www.11ty.dev/docs/), and your site will have a case neither of us thought of.

## When not to migrate

You wrote a dozen shortcodes, your data comes from an API at build time, or your URLs are generated
from a permalink template. Eleventy's programmable config is doing real work there, and Poops has
nowhere to put it — [the comparison](comparisons/jekyll-eleventy) has the rest of the rows.
