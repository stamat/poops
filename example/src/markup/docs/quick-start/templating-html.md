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

Next, get a site building end to end in [Build a Static Site](../static-site/).
