---
layout: docs
title: Building pages
navTitle: Building pages
description: Layouts, partials, front matter and Markdown — the building blocks of every Poops page.
order: 1
keywords:
  ["pages", "layout", "partials", "front matter", "markdown", "includes"]
---

# Building pages

A page is any `.html`, `.md`, or engine-native (`.njk`/`.liquid`) file under your markup `in`
directory. Its output path mirrors its source path: `src/markup/about.md` → `dist/about.html`.

## Front matter

Start a page with a YAML front-matter block. `layout` picks the wrapping template; everything else
is available under `page.*`:

```markdown
---
layout: default
title: About
description: Who we are and why.
order: 2
---

# About us

We build things with Poops.
```

Common fields: `title`, `description`, `layout`, `date`, `order`, `published`, `nav`, `navTitle`.
Any custom field you add is yours to use in templates and it flows into the search index.

## Layouts

Put base templates in `_layouts/` (a directory ignored for output, but on your `includePaths`). A
Nunjucks layout defines a `content` block:

```nunjucks
{% raw %}<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{ page.title or site.title }}</title>
  <meta name="description" content="{{ page.description or site.description }}">
  <link rel="stylesheet" href="{{ relativePathPrefix }}css/styles.min.css">
</head>
<body>
  {% include "site-header.html" %}
  <main>{% block content %}{% endblock %}</main>
  {% include "site-footer.html" %}
</body>
</html>{% endraw %}
```

The page body is rendered, then dropped into `{% raw %}{% block content %}{% endraw %}`.

> [!TIP]
> Always prefix asset and link URLs with `relativePathPrefix`. It resolves to the correct number
> of `../` for the page's depth, so a page at `dist/blog/post.html` still finds `css/styles.css`.

## Partials & includes

Reusable snippets live in `_partials/` (also on `includePaths`). Include them by file name:

```nunjucks
{% raw %}{% include "site-header.html" %}{% endraw %}
```

In Liquid, use `render`:

```liquid
{% raw %}{% render "site-header.liquid" %}{% endraw %}
```

## Global and page data

Three sources of data reach your templates:

- **`site`** — set once in the markup config (`site.title`, `site.url`, …).
- **`data` files** — JSON/YAML loaded as globals named after the file. `_data/links.json` becomes
  `links`, so `{% raw %}{{ links.github }}{% endraw %}` works everywhere.
- **`page`** — the current page's front matter.

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "site": { "title": "My Site" },
    "data": ["_data/links.json", "_data/authors.yaml"]
  }
}
```

> [!NOTE]
> File names are normalized: spaces, dashes and dots become underscores. `the awesome-links.json`
> is available as `{% raw %}{{ the_awesome_links }}{% endraw %}`.

## Markdown

Markdown files are rendered to HTML and then run through the template engine, so template
expressions work inside Markdown too. Fenced code blocks are **syntax-highlighted at build time**
(highlight.js) — you ship a CSS theme, not a highlighter.

````markdown
```js
const greet = (name) => `Hello, ${name}!`;
```
````

> [!INFO]
> Registered highlight languages include `js`, `ts`, `css`, `scss`, `html`, `json`, `bash`,
> `python`, `ruby`, `php`, `go`, `rust`, `yaml`, `sql`, `diff` and more. Omit the language to let
> highlight.js auto-detect.

## Useful filters

Poops adds template filters usable in both engines — `slugify`, `markdown`, `toc`, `date`,
`jsonify`, `svg`, `highlight`, `groupby`, the array helpers `concat` (returns a new array with the
value appended) and `push` (appends in place), and the image helpers `srcset`, `exif`, `images`:

```nunjucks
{% raw %}<h1>{{ page.title }}</h1>
<time>{{ page.date | date("MMMM D, YYYY") }}</time>
{{ "src/icons/logo.svg" | svg }}{% endraw %}
```

For markdown source, run `markdown` before `toc` so code-fence content doesn't get misread as headings:

```nunjucks
{% raw %}{{ page.content | markdown | toc }}{% endraw %}
```

Next: [Images & galleries](images-gallery).
