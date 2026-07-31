---
layout: poops-docs-theme/docs
title: Configuration reference
navTitle: Config reference
description: Every poops.json key that isn't a pipeline guide of its own — copy, banner, serve, livereload, watch, includePaths, search index, sitemap and nav options.
order: 1
keywords:
  [
    "config",
    "reference",
    "copy",
    "banner",
    "serve",
    "livereload",
    "watch",
    "includePaths",
    "searchIndex",
    "sitemap",
    "llms",
    "robots",
    "nav",
    "feed",
    "rss",
    "atom",
  ]
---

# Configuration reference

Every `poops.json` key, with a short explanation and example. The pipeline keys
(`scripts`, `styles`, `postcss`, `markup`, `reactor`, `images`) each link to a full guide for the
deep dive; everything else is documented in full on this page.

**Every key**

| Key                  | Purpose                                           | Documented in            |
| -------------------- | ------------------------------------------------- | ------------------------ |
| `scripts`            | Bundle / transpile JS & TS (esbuild)              | [↓](#scripts)            |
| `styles`             | Compile Sass / CSS                                | [↓](#styles)             |
| `postcss`            | PostCSS / Tailwind pass over compiled CSS         | [↓](#postcss)            |
| `reactor`            | Render React components to static HTML            | [↓](#reactor)            |
| `images`             | Responsive image processing                       | [↓](#images)             |
| `markup`             | Templates → static site                           | [↓](#markup)             |
| `markup.searchIndex` | JSON search index of every page                   | [↓](#markup-searchindex) |
| `markup.sitemap`     | `sitemap.xml` generation                          | [↓](#markup-sitemap)     |
| `markup.llms`        | `llms.txt` index for LLMs / GEO                    | [↓](#markup-llms)        |
| `markup.robots`      | `robots.txt` generation                           | [↓](#markup-robots)      |
| `markup.nav`         | Navigation-tree data                              | [↓](#markup-nav)         |
| `markup.feed`        | RSS / Atom feed from a collection                 | [↓](#markup-feed)        |
| `copy`               | Copy static assets into the output                | [↓](#copy)               |
| `banner`             | Comment stamped on every output file              | [↓](#banner)             |
| `serve`              | Local dev server                                  | [↓](#serve)              |
| `livereload`         | Reload the browser on changes                     | [↓](#livereload)         |
| `watch`              | Paths to watch (or `true` to auto-derive)         | [↓](#watch)              |
| `includePaths`       | Import-resolution roots (Sass `@use`, JS imports) | [↓](#includepaths)       |

The remaining `markup` sub-keys — `in`, `out`, `engine`, `site`, `data`, `includePaths`,
`timeDateFormat`, `collections`, `baseURL`, `autoescape` — are covered in
[Templating HTML](quick-start/templating-html).

## `scripts`

Bundles and transpiles JavaScript / TypeScript with [esbuild](https://esbuild.github.io/). A single
`{ in, out }` object or an array of them; `in` accepts a path, an array of paths, or globs — a
glob-matched `index.*` is named after its directory, relative to the glob's static prefix, so
`src/elements/*/index.ts` builds one bundle per component. `out` also accepts a template —
`{% raw %}{{dir}}{% endraw %}` (the match's directory relative to that static prefix) and
`{% raw %}{{name}}{% endraw %}` (its basename without extension) — naming one output per matched
entry, extension included. Per-entry `options` cover `sourcemap`, `minify`, `justMinified`, `format`
and `target`.

```json
{
  "scripts": {
    "in": "src/js/main.ts",
    "out": "dist/js/app.js",
    "options": {
      "sourcemap": true,
      "minify": true,
      "format": "iife",
      "target": "es2019"
    }
  }
}
```

Full guide: [Transpiling JS](quick-start/transpiling-js).

## `styles`

Compiles Sass/SCSS (and plain CSS) to CSS. Same `{ in, out, options }` shape as `scripts`, including
the `index.*` glob rule and the `out` templates; `options` adds `tokenPaths` for design-token inputs.
Pair it with [`postcss`](#postcss) for Autoprefixer or Tailwind.

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

Turns a directory of templates (Nunjucks or Liquid, plus Markdown) into a static site. Same shape as
a `scripts` or `styles` entry: `in` and `out`, everything else under `options` — `engine`, `site`,
`data`, `includePaths`, `timeDateFormat`, `collections`, `baseURL`, `autoescape`, plus
[`searchIndex`](#markup-searchindex), [`sitemap`](#markup-sitemap) and [`nav`](#markup-nav) below.

> [!WARNING]
> **Deprecated placement.** Poops 1.x also read these keys directly on `markup`
> (`{% raw %}"markup": { "site": … }{% endraw %}`). That still works in 2.x and logs a warning
> naming the key; it stops working in 3.0. Move them into `options`.

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "engine": "nunjucks",
      "site": { "title": "My Site", "description": "Built with Poops." }
    }
  }
}
```

The `site` object holds global data every template reads. The SEO filters pick up `title`,
`description`, `url`, `logo`, `author` and `lang` — `lang` feeds both the `<html lang>` attribute
(`{% raw %}<html lang="{{ page.lang or site.lang or 'en' }}">{% endraw %}`) and the JSON-LD
`inLanguage`; a page's front-matter `lang` overrides it. A `site.jsonld` object sets site-wide
JSON-LD defaults — `{% raw %}"jsonld": { "@type": "TechArticle" }{% endraw %}` for a docs site —
merged over the generated ones and still overridable per page. Add anything else you want globally
available — e.g. `repo` and `branch` to drive "Edit on GitHub" links (see
[Building a documentation site](static-site/docs-site)).

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
    "sizes": [
      { "width": 640 },
      { "width": 1280 },
      { "name": "thumb", "width": 200, "height": 200, "crop": true }
    ],
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
    {
      "in": ["src/static/ogimage.jpg", "src/static/favicon.ico", "src/fonts"],
      "out": "dist"
    },
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

## `exec`

Shell commands to run after a pipeline stage compiles — a post-processor that needs the built
output, like stripping comments from the unminified CSS or regenerating a reference page. Keyed
by stage, each value a command string or an array run in order:

```json
{
  "exec": {
    "styles": [
      "node script/strip-css-comments.mjs dist/styles.css",
      "node script/gen-reference.mjs"
    ],
    "build": "node script/deploy.mjs"
  }
}
```

Unlike chaining `poops -b && cmd` in an npm script, the hook runs on **every** rebuild — in
watch/dev too — so the post-processed output never drifts while you work. Commands run from the
project root; a failing command fails a `-b` build's exit code but is logged and swallowed in
watch so the watcher survives.

Stages:

| Stage     | Runs after                                                              |
| --------- | ----------------------------------------------------------------------- |
| `styles`  | CSS is final (after PostCSS) — use this for anything reading the built CSS |
| `scripts` | scripts compile                                                         |
| `reactor` | reactor components render (build only)                                  |
| `images`  | images process                                                         |
| `markup`  | markup renders                                                         |
| `copy`    | files copy                                                             |
| `build`   | once, after the full initial pipeline (not per watch rebuild)          |

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

| Option | Meaning                                                                |
| ------ | ---------------------------------------------------------------------- |
| `port` | Port to serve on (CLI `--port`/`-p` overrides).                        |
| `base` | Base path of the server — where your built HTML lives, e.g. `"/dist"`. |

## `livereload`

Reloads the browser when a build finishes. A switch, not an object — there is
nothing to configure:

```json
{
  "serve": { "base": "dist" },
  "livereload": true
}
```

It rides the `serve` port, so it needs `serve` to be on. Poops answers
`/__poops_reload` as a server-sent events stream and appends the client script
to every HTML page it serves — **your templates need no snippet**, and nothing
is written into your build output.

One save means one reload, after the build it triggered has settled. When
everything a build wrote is CSS, stylesheets are swapped in place instead:
no page reload, so scroll position and form state survive a style edit. The
browser reconnects on its own after a Poops restart.

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
_outside_ it — a shared folder above the entry, `node_modules` — aren't watched;
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

| Option                   | Meaning                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `out`                 | Output filename, written to the markup output directory.                                                |
| `minWordLength`          | Minimum word length considered a keyword. Default `3`.                                                  |
| `maxKeywords`            | Maximum keywords per page. Default `20`.                                                                |
| `globalFrequencyCeiling` | Drop words appearing in more than this fraction of pages. Default `0.8`.                                |
| `stopWords`              | `undefined` = bundled English list, `false` = disable, an inline array, or a path to a JSON array file. |

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
`out`.

A page's front matter `robots: noindex` (or `none`) drops it from the sitemap **and** `llms.txt`
— for drafts, thin or utility pages. Emit `{% raw %}{% if page.robots %}<meta name="robots"
content="{{ page.robots }}">{% endif %}{% endraw %}` in your layout `<head>` so the page carries
the directive itself.

## `markup.llms`

Writes an [`llms.txt`](https://llmstxt.org) — a Markdown index of your pages that LLMs and
generative engines (GEO) read to understand the site. An `# H1` title, a `> ` blockquote summary,
then `- [title](url): description` links grouped by URL path: the first folder is a `## section`, a
second folder nests as a `### subsection` (so `docs/quick-start/x.html` → `### Quick Start` under
`## Docs`), and root-level pages fall under the lead section. Collection sections are ordered
newest-first by `date`; other sections keep file order. `site.url` makes the links absolute;
collection index/pagination pages are skipped. A string sets the filename; the object form takes options:

| Option         | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `out`       | Output filename, written to the markup output directory.                       |
| `title`        | H1 title. Defaults to `site.title`.                                            |
| `description`  | Blockquote summary. Defaults to `site.description`.                             |
| `intro`        | Path (from project root) to a Markdown file inserted as free-form body context. |
| `sectionTitle` | Heading for the lead (uncollected) section. Default `"Pages"`.                  |
| `full`         | Also write the full-content file (below). `true` derives its name from `out` (`llms.txt` → `llms-full.txt`); a string sets it explicitly. |
| `fullIntro`    | Path (from project root) to a Markdown preamble inserted into the full-content file after its header. The `full` counterpart to `intro`. |

Point `intro` at a file authored for LLMs (e.g. `llms-intro.md`) — not a raw README, whose
badges, install noise and `##` headings collide with the generated sections.

`full` writes the companion full-content file — every page's full content concatenated into one
file (the index is the link map; this is the whole corpus). `true` names it after `out` with a
`-full` suffix (`llms.txt` → **`llms-full.txt`**, `ai.txt` → `ai-full.txt`); pass a string to set the
path yourself. Content is each page's Markdown
**source**, so only `.md`/`.markdown` pages are included (an `.njk`/`.liquid` source is template
code, not prose); `noindex` and collection index pages are dropped. The file opens with a
`# Full Documentation Archive for {title}` header, a one-line intro naming the site and a `> ` blockquote of the `description`, then each page
becomes an `# title` + `URL:` line + body, joined by `---`. Set `fullIntro` to a Markdown file path
(from the project root) to insert your own preamble after that header — the `full` counterpart to
`intro`; inserted verbatim (a missing file warns and is skipped). Unrendered
`{% raw %}{% … %}{% endraw %}` tags or shortcodes in a Markdown body pass through verbatim.

## `markup.robots`

Writes a `robots.txt`. A string writes an allow-all file (`User-agent: *`, empty `Disallow:`) with
a `Sitemap:` line pointing at your generated sitemap — absolute when `site.url` is set. The object
form takes options:

| Option      | Meaning                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `out`    | Output filename, written to the markup output directory.                        |
| `userAgent` | The `User-agent` line. Default `"*"`.                                            |
| `disallow`  | A path or array of paths to disallow.                                           |
| `allow`     | A path or array of paths to explicitly allow.                                   |
| `sitemap`   | An explicit `Sitemap:` URL, or `false` to omit the line. Auto-derived by default. |

## `markup.nav`

Builds the page hierarchy as sidebar-ready data — the `nav` template global plus a nested JSON
file. See [Building a documentation site](static-site/docs-site) for the walkthrough; the options:

| Option        | Meaning                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `out`      | Output filename, written to the markup output directory.                                                                                                                                |
| `collections` | `true` = include every collection page nested under its collection (default); `false` = exclude all; `["docs"]` = allowlist; `"index"` = only each collection's landing page as a leaf. |
| `home`        | `false` drops the site's root index page from the tree. Default `true`.                                                                                                                 |
| `root`        | Scope the tree to a subdirectory (e.g. `"docs"`); its children are emitted at the top level with the section index pinned first.                                                        |

Each node has `title`, `url` (omitted on synthesized section nodes), `order` when set, and
`children` when it has subpages:

```json
[
  {
    "title": "Guide",
    "url": "guide",
    "order": 1,
    "children": [
      { "title": "Getting Started", "url": "guide/getting-started", "order": 1 }
    ]
  }
]
```

Front matter shaping the tree: `order` (sort among siblings), `navTitle` (sidebar label),
`nav: false` (hide from sidebar). If nothing survives filtering, an empty array is written.

## `markup.feed`

Generates an RSS or Atom subscription feed from a [collection](static-site/blog-collections) —
no hand-authored feed template. Items are the collection's posts newest-first by `date` (capped at
`limit`), with channel metadata pulled from your `site` data. `robots: noindex` posts are excluded,
and links / `guid`s are made absolute with `site.url`. The object form:

| Option        | Meaning                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `collection`  | Collection to feed from. Omit to emit a feed for **every** collection.                                            |
| `out`      | File to write. A bare filename (default `feed.xml`) goes in the collection's folder; a slashed path is used as-is. |
| `type`        | `"rss"` (default) or `"atom"`.                                                                                    |
| `limit`       | Max items, newest first. Default `20`.                                                                            |
| `title`       | Channel title. Default `"<Collection> \| <site.title>"`.                                                          |
| `description` | Channel description. Default `site.description`.                                                                  |
| `author`      | Feed author. Default `site.author`.                                                                               |
| `lang`        | Feed language. Default `site.lang`.                                                                               |
| `content`     | `true` adds each post's full article HTML (RSS `<content:encoded>`, Atom `<content type="html">`). Default off.   |

Shorthand: `true` (or a filename string) emits an RSS feed for every collection; an array of these
objects generates several feeds at once (e.g. an RSS and an Atom for one collection). Item
`<description>`/`<summary>` uses each post's `description`, falling back to its auto-`excerpt`. Link
readers to it from your layout `<head>`:

```html
{% raw %}<link rel="alternate" type="application/rss+xml" href="{{ site.url }}/changelog/feed.rss">{% endraw %}
```

`content: true` renders each post's Markdown **source** to article-body HTML (not the whole page —
no layout/nav chrome), so only `.md`/`.markdown` posts get a `<content:encoded>`; others fall back
to `<description>` alone. Unrendered `{% raw %}{% … %}{% endraw %}` tags or shortcodes in a body
pass through verbatim.
