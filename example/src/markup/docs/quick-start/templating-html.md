---
layout: docs
title: Templating HTML
navTitle: Templating HTML
description: Generate HTML with swappable template engines — Nunjucks or Liquid — plus front matter, data, includes and the image tag.
order: 4
keywords: ["templating", "nunjucks", "liquid", "html", "markdown", "front matter", "includes", "image"]
---

# Templating HTML

The `markup` key turns a directory of templates into a static site. Files keep their directory
structure in the output; directories starting with `_` (like `_layouts`, `_partials`) are treated
as includes and not emitted.

```json
{
  "markup": {
    "engine": "nunjucks",
    "in": "src/markup",
    "out": "dist",
    "site": { "title": "My Site", "description": "Built with Poops." },
    "data": ["_data/links.json", "_data/nav.yaml"],
    "includePaths": ["_layouts", "_partials"]
  }
}
```

- **`in`** — the templates directory. `.html`, `.md`, and the engine's native extension are processed.
- **`out`** — the output directory.
- **`site`** — global data available to every page as `site.*`.
- **`data`** — JSON/YAML files loaded as globals, named after the file (`links.json` → `links`).
- **`includePaths`** — extra folders on the include search path for partials/layouts.
- **`baseURL`** *(optional)* — a fixed URL prefix that replaces the computed relative prefixes.
  When set, `relativePathPrefix` always resolves to this value (trailing slash ensured) instead of
  the page-depth `./`/`../`. Useful when deploying under a subdirectory, e.g. `"/blog"` for
  `domain.com/blog/`. The `--base-url` CLI flag overrides it per environment.

Every page can carry **front matter** — a YAML block at the top that sets `title`, `description`,
`layout`, `date`, `order`, and any custom fields you invent:

```markdown
---
layout: default
title: About
description: Who we are.
---

# About us
```

The body is rendered by the engine (and Markdown, for `.md`), then wrapped in the layout named by
`layout`. Markdown code fences are syntax-highlighted at build time.

> [!TIP]
> Poops exposes `relativePathPrefix` on every page — a correct `./` / `../` prefix for the page's
> depth. Prefix asset and link URLs with it and your site works from any subdirectory or even
> `file://`.

## Nunjucks (default)

[Nunjucks](https://mozilla.github.io/nunjucks/) is Mozilla's Jinja2-inspired engine. A layout
uses blocks:

```nunjucks
{% raw %}<!DOCTYPE html>
<html>
<head><title>{{ page.title or site.title }}</title></head>
<body>
  {% include "header.html" %}
  {% block content %}{% endblock %}
</body>
</html>{% endraw %}
```

A page extends it:

```nunjucks
{% raw %}{% extends "default.html" %}
{% block content %}
  <h1>{{ page.title }}</h1>
{% endblock %}{% endraw %}
```

## Liquid

Prefer Shopify-flavoured [Liquid](https://liquidjs.com/)? Set `"engine": "liquid"`. Same feature
set — collections, search index, sitemap, nav, custom tags and filters all work identically. Only
the syntax differs:

| Feature | Nunjucks | Liquid |
| --- | --- | --- |
| File extension | `.njk` | `.liquid` |
| Inheritance | `{% raw %}{% extends "base.html" %}{% endraw %}` | `{% raw %}{% layout "base.liquid" %}{% endraw %}` |
| Default value | `{% raw %}{{ x or "y" }}{% endraw %}` | `{% raw %}{{ x \| default: "y" }}{% endraw %}` |
| Includes | `{% raw %}{% include "p.njk" %}{% endraw %}` | `{% raw %}{% render "p.liquid" %}{% endraw %}` |
| Safe output | `{% raw %}{{ html \| safe }}{% endraw %}` | `{% raw %}{{ html }}{% endraw %}` (no escaping) |

```liquid
{% raw %}{% layout "default.liquid" %}
{% block content %}
  <h1>{{ page.title }}</h1>
{% endblock %}{% endraw %}
```

> [!INFO]
> Pick the engine you already know. There is no functional reason to prefer one over the other in
> Poops — the collections, nav, search and image features are engine-agnostic.

## Custom engines

`engine` also accepts a **module specifier** — an npm package name or a path relative to your
project root — so you can bring your own template engine or extend a built-in one. The module's
default export must be an engine class:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "engine": "poops-shopify"
  }
}
```

An engine class implements this contract (the two built-ins in
[`lib/markup/engines/`](https://github.com/stamat/poops/tree/main/lib/markup/engines) are the
reference implementations):

```js
export default class MyEngine {
  constructor(templatesDir, includePaths, options) {}      // options: { autoescape }
  get fileExtension() { return '.liquid' }                 // native template extension
  get indexableExtensions() { return new Set(['.html']) }  // eligible for search index / nav
  get markupExtensions() { return 'html|liquid|md' }       // glob alternation of processed extensions
  registerFilters({ timeDateFormat, markupOut }) {}
  registerTags(getOutputDir) {}
  setGlobal(key, value) {}
  removeGlobal(key) {}
  async render(templatePath, context) { return 'html' }    // templatePath is an absolute path
  async renderString(source, context) { return 'html' }
}
```

Optionally implement `replaceOutExtensions(outputPath)` to control how source extensions map to
output (the default maps `.md` / `.njk` / `.liquid` to `.html`; a theme engine might flatten paths
instead).

The easy path is **extending a built-in** — deep imports are supported for exactly this:

```js
import LiquidEngine from 'poops/lib/markup/engines/liquid.js'

export default class MyEngine extends LiquidEngine {
  registerFilters(opts) {
    super.registerFilters(opts)
    this.engine.registerFilter('shout', (str) => String(str).toUpperCase())
  }
}
```

> [!NOTE]
> The specifier resolves against your project's `node_modules` (or a relative path from the project
> root), so a locally linked engine works too. [`poops-shopify`](https://github.com/stamat/poops-shopify)
> is a full example — a Shopify Liquid engine that maps templates into a theme directory.

## Images

Both engines ship an `{% raw %}{% image %}{% endraw %}` tag that emits a responsive `<img>` with a
`srcset`. Image *processing* is a separate step (see [Images & galleries](../static-site/images-gallery));
the tag just discovers the generated variants and writes correct markup.

Name your variants `{name}-{width}w.{ext}` (e.g. `photo-320w.webp`, `photo-640w.webp`) and call:

```nunjucks
{% raw %}{% image 'static/photo.jpg', alt='Hero', sizes='(max-width: 640px) 100vw, 50vw' %}{% endraw %}
```

Output:

```html
<img
  src="static/photo-640w.jpg"
  srcset="static/photo-320w.webp 320w, static/photo-640w.webp 640w, static/photo-960w.webp 960w"
  sizes="(max-width: 640px) 100vw, 50vw"
  alt="Hero" loading="lazy" />
```

The tag prefers `avif` > `webp` > original, prepends `relativePathPrefix`, defaults to
`loading="lazy"`, and falls back to a plain `<img>` if no variants exist.

> [!NOTE]
> If you run [poops-images](https://github.com/stamat/poops-images), the tag also reads exact
> `width`/`height` from its cache to prevent layout shift, and unlocks the `exif` and `images`
> filters. More in [Images & galleries](../static-site/images-gallery).

## Google Fonts

The `{% raw %}{% googleFonts %}{% endraw %}` tag emits Google Fonts `<link>` tags with preconnect
hints. Pass an array of font names, or objects for weights and italics:

```nunjucks
{% raw %}{% googleFonts ["DM Sans", {name: "Poppins", weights: [400, 700], ital: true}] %}{% endraw %}
```

Output:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans&family=Poppins:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
```

Font object options: `name`, `weights` (e.g. `[400, 700]`), `ital` (include italics), `display`
(defaults to `swap`).

> [!NOTE]
> Liquid syntax has no inline arrays — pass a variable instead: define the array in a data file
> (e.g. `fonts.json`) and call `{% raw %}{% googleFonts fonts %}{% endraw %}`.

Next, get a site building end to end in [Build a Static Site](../static-site/).
