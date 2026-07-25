---
layout: docs
title: Templating HTML
navTitle: Templating HTML
description: Generate HTML with swappable template engines — Nunjucks or Liquid — plus front matter, data, includes and the image tag.
order: 4
keywords: ["templating", "nunjucks", "liquid", "html", "markdown", "front matter", "includes", "image", "filters", "jsonld", "json-ld", "structured data", "geo", "seo", "schema.org", "canonical", "open graph"]
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

## Markdown

`.md` files are rendered to HTML before the engine wraps them in a layout, so a page can be pure
Markdown with front matter — Jekyll-style. The same renderer powers the `markdown` filter, so inline
Markdown in a template produces identical output.

### GitHub Flavored Markdown (GFM)

Poops renders [GFM](https://github.github.com/gfm/) plus a few GitHub extras — the Markdown you
already write in a repo README works here:

| Feature | Syntax |
| --- | --- |
| Tables | `\| a \| b \|` with a `\| --- \| --- \|` divider row |
| Task lists | `- [ ] todo` / `- [x] done` |
| Strikethrough | `~~gone~~` |
| Autolinks | a bare `https://…` URL becomes a link |
| Emoji shortcodes | `:rocket:` → 🚀 |
| Footnotes | `text[^1]` with a `[^1]: note` definition |
| Alerts | `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`, `[!INFO]` |

Alerts render as styled callout blocks (`[!INFO]` is a Poops-added variant — the others are
GitHub's). Every heading also gets a slug `id` and an empty permalink anchor (`.heading-anchor`), so
table-of-contents generation and in-page links work with no extra markup.

> [!NOTE]
> To show a template tag literally inside a fenced code block, wrap the sample in a `raw` block so
> the engine prints it verbatim instead of evaluating it.

### Syntax highlighting

Fenced code blocks are highlighted at **build time** with
[highlight.js](https://highlightjs.org/) — no client-side script, no theme JS. Tag the fence with a
language; an unknown or missing language falls back to auto-detection. Registered languages (with
aliases):

| Language | Fence tags |
| --- | --- |
| JavaScript | `javascript`, `js` |
| TypeScript | `typescript`, `ts` |
| CSS | `css` |
| Sass (SCSS) | `scss` |
| HTML / XML | `html`, `xml` |
| JSON | `json` |
| Bash | `bash`, `sh` |
| Shell session | `shell` |
| Python | `python`, `py` |
| Ruby | `ruby`, `rb` |
| PHP | `php` |
| Java | `java` |
| C | `c` |
| C++ | `cpp` |
| C# | `csharp`, `cs` |
| Go | `go` |
| Rust | `rust`, `rs` |
| YAML | `yaml`, `yml` |
| Markdown | `markdown`, `md` |
| SQL | `sql` |
| Diff | `diff` |

The output carries `hljs` and `language-{tag}` classes on the `<code>` element — pair it with any
highlight.js stylesheet for colors. Tag a fence with a language:

````markdown
```javascript
export function greet(name) {
  const msg = `Hello, ${name}!`
  console.log(msg)
  return msg
}
```
````

…and it renders highlighted at build time:

```javascript
export function greet(name) {
  const msg = `Hello, ${name}!`
  console.log(msg)
  return msg
}
```

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

## Filters

Both engines ship the same built-in filters. The only syntax difference is how arguments are
passed: Nunjucks uses parentheses `{% raw %}{{ x | filter("arg") }}{% endraw %}`, Liquid uses a colon
`{% raw %}{{ x | filter: "arg" }}{% endraw %}`.

| Filter | Does | Example (Nunjucks) |
| --- | --- | --- |
| `slugify` | string → URL slug | `{% raw %}{{ title \| slugify }}{% endraw %}` |
| `jsonify` | value → JSON string | `{% raw %}{{ obj \| jsonify }}{% endraw %}` |
| `markdown` | Markdown → HTML (GFM) | `{% raw %}{{ text \| markdown }}{% endraw %}` |
| `date` | format a date (dayjs tokens) | `{% raw %}{{ post.date \| date("MMM D, YYYY") }}{% endraw %}` |
| `toc` | table of contents from headings | `{% raw %}{{ content \| toc }}{% endraw %}` |
| `concat` | new array with value appended | `{% raw %}{{ items \| concat("c") }}{% endraw %}` |
| `push` | append to an array in place | `{% raw %}{{ items \| push("c") }}{% endraw %}` |
| `svg` | inline an SVG file | `{% raw %}{{ 'icons/logo.svg' \| svg }}{% endraw %}` |
| `highlight` | syntax-highlight a code string | `{% raw %}{{ code \| highlight("js") }}{% endraw %}` |
| `groupby` | group an array by a field | `{% raw %}{{ posts \| groupby("date", "year") }}{% endraw %}` |
| `srcset` | build a `srcset` for an image | `{% raw %}{{ 'photo.jpg' \| srcset }}{% endraw %}` |
| `exif` | EXIF object for an image | `{% raw %}{{ 'photo.jpg' \| exif }}{% endraw %}` |
| `images` | list images in a directory | `{% raw %}{{ 'static/img' \| images }}{% endraw %}` |
| `og` | Open Graph + Twitter card `<meta>` | `{% raw %}{{ page \| og(site) }}{% endraw %}` |
| `canonical` | `<link rel="canonical">` dedup tag | `{% raw %}{{ page \| canonical(site) }}{% endraw %}` |
| `jsonld` | schema.org JSON-LD for GEO | `{% raw %}{{ page \| jsonld(site) }}{% endraw %}` |
| `breadcrumb` | visible breadcrumb `<nav>` trail | `{% raw %}{{ page \| breadcrumb(site, relativePathPrefix) }}{% endraw %}` |

`srcset`, `exif` and `images` need the [poops-images](https://github.com/stamat/poops-images)
compile cache — see [Images & galleries](../static-site/images-gallery).

### Social & structured data (Open Graph, JSON-LD)

Two filters turn a page's front matter into the metadata search engines, generative engines (GEO)
and social platforms read. Drop both in your layout `<head>`:

```nunjucks
{% raw %}{{ page | canonical(site) }}
{{ page | og(site) }}
{{ page | jsonld(site) }}{% endraw %}
```

`canonical` emits a `<link rel="canonical">` with the page's authoritative absolute URL (`site.url` +
its `url`) — the dedup signal that stops query-string and duplicate URLs splitting your ranking.
Front matter `canonical` overrides it (absolute URL, or a path resolved against `site.url`); the
homepage canonicals to the site root.

`og` emits Open Graph + Twitter-card `<meta>` tags for link previews. `og:type` is `article` when
the page has a `date`, else `website`; it pulls `title`, `description`, `url`, `image` and
`site_name`, adds `article:*` timestamps for posts, and picks `summary_large_image` when an image is
set. A missing `description` falls back to the page's auto-`excerpt` (first paragraph), then
`site.description`. Set an `og` object in front matter to add or override any tag (e.g. `og:image:alt`).

`jsonld` turns a page's front matter into a schema.org
`{% raw %}<script type="application/ld+json">{% endraw %}` block — the structured data search and
generative engines (GEO) read. Drop it in your layout `<head>`:

```nunjucks
{% raw %}{{ page | jsonld(site) }}{% endraw %}
```

Liquid: `{% raw %}{{ page | jsonld: site }}{% endraw %}`. The `@type` auto-detects — `BlogPosting`
when the page has a `date`, otherwise `WebPage` — pulling `title`, `description`, `url` (made
absolute via `site.url`), `date`, `author`, `image` and more from front matter. `description` shares
the same `page.excerpt` → `site.description` fallback as `og`. Values are escaped so they can't break
out of the `<script>`.

Set `site.logo` and the publisher gains a `logo` ImageObject (made absolute) — Google Article rich
results require it. On the homepage (a page with no `url`) a second `WebSite` block is emitted,
declaring the site name for search results; on nested pages a `BreadcrumbList` block is auto-appended
(see [Breadcrumbs](#breadcrumbs)).

`site.lang` (a page's front-matter `lang` overrides it) sets the JSON-LD `inLanguage` on every
block. Reuse it for the language attribute too — `{% raw %}<html lang="{{ page.lang or site.lang or 'en' }}">{% endraw %}` —
so the declared language and the markup stay in sync.

For full control, set a `jsonld` object in front matter; its keys merge over (and override) the
defaults, including `@type`:

```yaml
---
title: How to brew coffee
date: 2026-01-01
jsonld:
  "@type": HowTo
  totalTime: PT5M
---
```

#### Common `@type` values

poops picks `BlogPosting` or `WebPage` for you; override `@type` (and add the type's own fields)
via the `jsonld` object for anything else. The types search and generative engines act on most:

| `@type` | Use for | Notable extra fields |
| --- | --- | --- |
| `WebPage` | generic page (poops default) | — |
| `BlogPosting` / `Article` | blog posts, articles (auto when `date` is set) | `headline`, `datePublished`, `author` |
| `NewsArticle` | news / press | `dateline`, `datePublished` |
| `HowTo` | step-by-step guides | `step[]`, `totalTime`, `supply`, `tool` |
| `FAQPage` | a page of Q&As | `mainEntity[]` (`Question` → `acceptedAnswer`) |
| `QAPage` | a single question thread | `mainEntity` (`Question`) |
| `Product` | product pages | `offers` (`Offer`), `aggregateRating`, `brand` |
| `Recipe` | recipes | `recipeIngredient[]`, `cookTime`, `nutrition` |
| `Event` | events | `startDate`, `location`, `offers` |
| `Course` | courses / lessons | `provider`, `hasCourseInstance` |
| `VideoObject` | pages built around a video | `thumbnailUrl`, `uploadDate`, `duration` |
| `SoftwareApplication` | apps / tools | `applicationCategory`, `operatingSystem`, `offers` |
| `Organization` | the site's company/brand entity | `logo`, `sameAs[]`, `contactPoint` |
| `Person` | author / profile pages | `jobTitle`, `sameAs[]` |
| `BreadcrumbList` | breadcrumb trails | `itemListElement[]` (`ListItem`); auto-emitted on nested pages |
| `WebSite` | one site-level block (homepage) | declares the site name; auto-emitted on the homepage |

Full vocabulary at [schema.org/docs/full](https://schema.org/docs/full.html); check what
[Google supports](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
for rich results. Validate a page with the [Rich Results Test](https://search.google.com/test/rich-results)
or the [Schema Markup Validator](https://validator.schema.org/).

### Breadcrumbs

`jsonld` already gives you the SEO half for free: on any **nested** page (its `url` has at least one
folder) it auto-appends a `BreadcrumbList` block — a Google rich result — with no extra markup. The
trail is derived from the page's URL depth: the site root, each ancestor folder (humanized, e.g.
`docs/static-site` → *Static Site*), then the page itself. Item URLs are absolute, so it needs
`site.url`.

For a **visible** trail in the page body, add the `breadcrumb` filter — same crumbs, rendered as a
`{% raw %}<nav class="breadcrumb"><ol>{% endraw %}`:

```nunjucks
{% raw %}{{ page | breadcrumb(site, relativePathPrefix) }}{% endraw %}
```

Liquid: `{% raw %}{{ page | breadcrumb: site, relativePathPrefix }}{% endraw %}`. Pass
`relativePathPrefix` so the links resolve against the current page (localhost in dev, your deployed
path in prod) instead of the absolute domain — the same convention the nav uses. The last crumb is
the current page, rendered as `aria-current` text rather than a link. Both outputs return nothing on
the homepage or a single-crumb page.

The **home crumb** is optional. Turn it off (or rename it) site-wide via `site.breadcrumb`, or
per-page in front matter — front matter wins:

```yaml
# poops.json → markup.site
breadcrumb:
  home: false        # drop the leading "Home" crumb
  homeLabel: Start   # or just rename it
```

With `home: false`, top-level pages (only one crumb left) render nothing; nested pages still show
their folder trail. Set `breadcrumb: false` on a page (or on `site`) to disable both the visible
trail and the JSON-LD entirely.

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
