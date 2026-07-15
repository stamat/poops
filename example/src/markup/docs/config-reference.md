---
layout: docs
title: Configuration reference
navTitle: Config reference
description: Every poops.json key that isn't a pipeline guide of its own — copy, banner, serve, livereload, watch, includePaths, search index, sitemap and nav options.
order: 4
keywords: ["config", "reference", "copy", "banner", "serve", "livereload", "watch", "includePaths", "searchIndex", "sitemap", "nav"]
---

# Configuration reference

Every `poops.json` key, with a short explanation and example. The pipeline keys
(`scripts`, `styles`, `postcss`, `markup`, `reactor`, `images`) each link to a full guide for the
deep dive; everything else is documented in full on this page.

## Every key

| Key | Purpose | Documented in |
| --- | --- | --- |
| `scripts` | Bundle / transpile JS & TS (esbuild) | [↓](#scripts) |
| `styles` | Compile Sass / CSS | [↓](#styles) |
| `postcss` | PostCSS / Tailwind pass over compiled CSS | [↓](#postcss) |
| `reactor` | Render React components to static HTML | [↓](#reactor) |
| `images` | Responsive image processing | [↓](#images) |
| `markup` | Templates → static site | [↓](#markup) |
| `markup.searchIndex` | JSON search index of every page | [↓](#markup-searchindex) |
| `markup.sitemap` | `sitemap.xml` generation | [↓](#markup-sitemap) |
| `markup.nav` | Navigation-tree data | [↓](#markup-nav) |
| `copy` | Copy static assets into the output | [↓](#copy) |
| `banner` | Comment stamped on every output file | [↓](#banner) |
| `serve` | Local dev server | [↓](#serve) |
| `livereload` | Reload the browser on changes | [↓](#livereload) |
| `watch` | Paths to watch (or `true` to auto-derive) | [↓](#watch) |
| `includePaths` | Import-resolution roots (Sass `@use`, JS imports) | [↓](#includepaths) |

The remaining `markup` sub-keys — `in`, `out`, `engine`, `site`, `data`, `includePaths`,
`timeDateFormat`, `collections`, `baseURL`, `autoescape` — are covered in
[Templating HTML](quick-start/templating-html). `ssg` is a backwards-compatible alias for `reactor`.

## `scripts`

Bundles and transpiles JavaScript / TypeScript with [esbuild](https://esbuild.github.io/). A single
`{ in, out }` object or an array of them; `in` accepts a path, an array of paths, or globs. Per-entry
`options` cover `sourcemap`, `minify`, `justMinified`, `format` and `target`.

```json
{
  "scripts": {
    "in": "src/js/main.ts",
    "out": "dist/js/app.js",
    "options": { "sourcemap": true, "minify": true, "format": "iife", "target": "es2019" }
  }
}
```

Full guide: [Transpiling JS](quick-start/transpiling-js).

## `styles`

Compiles Sass/SCSS (and plain CSS) to CSS. Same `{ in, out, options }` shape as `scripts`; `options`
adds `tokenPaths` for design-token inputs. Pair it with [`postcss`](#postcss) for Autoprefixer or
Tailwind.

```json
{
  "styles": {
    "in": "src/scss/index.scss",
    "out": "dist/css/app.css",
    "options": { "sourcemap": true, "minify": true }
  }
}
```

Full guide: [Transpiling CSS](quick-start/transpiling-css).

## `postcss`

Runs a [PostCSS](https://postcss.org/) pipeline — separate from the Sass `styles` step — for
[Tailwind](https://tailwindcss.com/), Autoprefixer or any PostCSS plugin. `options.plugins` lists the
plugins to load. Accepts one entry or an array. Needs `postcss` installed (`npm i -D postcss`).

```json
{
  "postcss": {
    "in": "src/css/main.css",
    "out": "dist/css/main.css",
    "options": { "plugins": ["@tailwindcss/postcss"], "minify": true }
  }
}
```

Full guide: [PostCSS & Tailwind](quick-start/postcss-tailwind).

## `markup`

Turns a directory of templates (Nunjucks or Liquid, plus Markdown) into a static site. Sub-keys:
`in`, `out`, `engine`, `site`, `data`, `includePaths`, `timeDateFormat`, `collections`, `baseURL`,
`autoescape`, plus [`searchIndex`](#markup-searchindex), [`sitemap`](#markup-sitemap) and
[`nav`](#markup-nav) below.

```json
{
  "markup": {
    "engine": "nunjucks",
    "in": "src/markup",
    "out": "dist",
    "site": { "title": "My Site", "description": "Built with Poops." }
  }
}
```

Full guide: [Templating HTML](quick-start/templating-html).

## `reactor`

Renders React components to static HTML at build time and emits a hydration bundle. `component` is
the component rendered to markup, `inject` names the global the HTML is exposed as, and `in`/`out`
are the client hydration entry/bundle.

```json
{
  "reactor": {
    "component": "src/js/App.jsx",
    "inject": "app_html",
    "in": "src/js/app-hydrate.jsx",
    "out": "dist/js/app-hydrate.js"
  }
}
```

Full guide: [React](quick-start/react).

## `images`

Responsive image processing — resize, convert (WebP/AVIF), crop and read EXIF — via
[poops-images](https://github.com/stamat/poops-images). `sizes` is the responsive ladder plus any
named crops; `format` lists output formats.

```json
{
  "images": {
    "in": "src/images",
    "out": "dist/images",
    "sizes": [{ "width": 640 }, { "width": 1280 }, { "name": "thumb", "width": 200, "height": 200, "crop": true }],
    "format": ["webp"]
  }
}
```

Full guide: [Images & galleries](static-site/images-gallery).

## `copy`

Copies files or directories into the output — static assets like fonts, favicons, OG images.
Accepts a single `{ in, out }` object or an array of them; `in` can be a path or an array of
paths:

```json
{
  "copy": [
    { "in": ["src/static/ogimage.jpg", "src/static/favicon.ico", "src/fonts"], "out": "dist" },
    { "in": "images", "out": "dist/static" }
  ]
}
```

Input paths accept **glob** and **extglob** patterns (everything except POSIX character classes
like `[[:alpha:]]`):

```json
{
  "copy": {
    "in": [
      "images/**/awesome.{jpeg,jpg,png}",
      "notes/info[0-9].txt",
      "assets/!(vendor)/*.js",
      "fonts/@(woff|woff2)/*.+(woff|woff2)"
    ],
    "out": "dist"
  }
}
```

## `banner`

A comment stamped on top of every output file. Templatable via mustache from your project's
`package.json` — available variables: `name`, `version`, `homepage`, `license`, `author`,
`description`:

```nunjucks
{% raw %}{
  "banner": "/* {{ name }} v{{ version }} | {{ homepage }} | {{ license }} License */"
}{% endraw %}
```

A plain string works too — templating is optional.

## `serve`

A local dev server:

| Option | Meaning |
| --- | --- |
| `port` | Port to serve on (CLI `--port`/`-p` overrides). |
| `base` | Base path of the server — where your built HTML lives, e.g. `"/dist"`. |

## `livereload`

Reloads the browser on file changes. `true` runs on the default port `35729`, or pass options:

| Option | Meaning |
| --- | --- |
| `port` | LiveReload port (CLI `--livereload-port`/`-l` overrides). |
| `exclude` | Glob patterns to ignore, e.g. `["vendor/**/*"]`. |
| `extraExts` | Extra file extensions (no dot) that trigger a refresh, added to the defaults. |
| `exts` | Extension list that **replaces** the defaults entirely. |

Default trigger extensions: `html`, `css`, `js`, `png`, `gif`, `jpg`, `php`, `php5`, `py`, `rb`,
`erb`, `coffee`. Working with Nunjucks or Slim templates? Add them:

```json
{
  "livereload": { "extraExts": ["njk", "slim"] }
}
```

Your pages need the LiveReload snippet in development (mind the port if you changed it):

```html
<script>
  document.write(
    '<script src="http://' +
      (location.host || "localhost").split(":")[0] +
      ':35729/livereload.js?snipver=1"></' +
      "script>",
  );
</script>
```

A [browser extension](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei?hl=en)
works instead of the snippet too.

## `watch`

An array of paths to watch; changes rebuild the affected pipeline:

```json
{
  "watch": ["src"]
}
```

Set it to `true` to derive the list automatically from every task's `in` path
(file entries like a script/style bundle collapse to their parent dir so
sibling imports still trigger a rebuild):

```json
{
  "watch": true
}
```

This covers sources that live under a task's own directory. Imports that reach
*outside* it — a shared folder above the entry, `node_modules` — aren't watched;
use an explicit array for those.

## `includePaths`

Paths to resolve imports from (Sass `@use`, script imports). `node_modules` is the default —
**if you set this key, include `node_modules` yourself**, since the value replaces the default:

```json
{
  "includePaths": ["node_modules", "lib"]
}
```

## `markup.searchIndex`

Writes a JSON search index of every page. A string sets the output filename with defaults; the
object form takes options:

| Option | Meaning |
| --- | --- |
| `output` | Output filename, written to the markup output directory. |
| `minWordLength` | Minimum word length considered a keyword. Default `3`. |
| `maxKeywords` | Maximum keywords per page. Default `20`. |
| `globalFrequencyCeiling` | Drop words appearing in more than this fraction of pages. Default `0.8`. |
| `stopWords` | `undefined` = bundled English list, `false` = disable, an inline array, or a path to a JSON array file. |

All front matter fields pass through to the index; internal fields (`content`, `isIndex`,
`layout`, `published`) are stripped. A page's own `keywords` front matter overrides the
auto-extracted ones. Pages with `published: false` are excluded.

```json
[
  {
    "title": "My Post",
    "description": "A great post about things.",
    "url": "blog/my-post.html",
    "keywords": ["javascript", "bundler", "esbuild"]
  }
]
```

## `markup.sitemap`

Writes a standard `sitemap.xml` with `<loc>` and `<lastmod>` (from front matter `date`). If
`site.url` is set, it is prepended to all URLs. Collection index/pagination pages are included
here but excluded from the search index. A string sets the filename; the object form takes
`output`.

## `markup.nav`

Builds the page hierarchy as sidebar-ready data — the `nav` template global plus a nested JSON
file. See [Building a documentation site](static-site/docs-site) for the walkthrough; the options:

| Option | Meaning |
| --- | --- |
| `output` | Output filename, written to the markup output directory. |
| `collections` | `true` = include every collection page nested under its collection (default); `false` = exclude all; `["docs"]` = allowlist; `"index"` = only each collection's landing page as a leaf. |
| `home` | `false` drops the site's root index page from the tree. Default `true`. |
| `root` | Scope the tree to a subdirectory (e.g. `"docs"`); its children are emitted at the top level with the section index pinned first. |

Each node has `title`, `url` (omitted on synthesized section nodes), `order` when set, and
`children` when it has subpages:

```json
[
  { "title": "Guide", "url": "guide", "order": 1, "children": [
    { "title": "Getting Started", "url": "guide/getting-started", "order": 1 }
  ]}
]
```

Front matter shaping the tree: `order` (sort among siblings), `navTitle` (sidebar label),
`nav: false` (hide from sidebar). If nothing survives filtering, an empty array is written.
