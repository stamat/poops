---
layout: poops-docs-theme/docs
title: Markup engine API
navTitle: Engine API
description: The interface a custom markup engine implements — how Poops loads it, the required methods and getters, and the optional hooks for watch-mode caching and incremental rebuilds.
order: 5
keywords:
  [
    "engine",
    "api",
    "plugin",
    "custom engine",
    "nunjucks",
    "liquid",
    "markup",
    "render",
    "filters",
    "tags",
    "invalidate",
    "incremental"
  ]
---

# Markup engine API

The markup pipeline doesn't render templates itself — it drives an **engine**.
Nunjucks and Liquid ship built in, but the engine slot accepts any module that
implements the interface on this page. This is how
[poops-shopify](https://github.com/stamat/poops-shopify) plugs a Shopify-flavored
Liquid engine into the same pipeline.

The engine interface is public API: it follows semver from v2.0.0 on. A
breaking change to it means a major version of Poops.

## Pointing Poops at an engine

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "engine": "nunjucks"
    }
  }
}
```

`engine` resolves in three ways:

- **Builtin name** — `"nunjucks"` (default) or `"liquid"`.
- **Path** — anything starting with `.`, `/`, or an absolute path is imported
  as a file relative to the project root: `"./tools/my-engine.js"`.
- **Package** — any other string is imported as a bare specifier from your
  `node_modules`: `"poops-shopify"`.

In all cases the module's **default export** must be the engine class.

## Lifecycle

Poops instantiates the engine once, lazily, before the first markup compile:

```js
new EngineClass(templatesDir, includePaths, { autoescape })
```

- `templatesDir` — absolute path of `markup.in`.
- `includePaths` — the `markup.includePaths` array from config (layout/partial
  directories, relative to `templatesDir`).
- `options.autoescape` — the config's autoescape flag.

Immediately after construction, Poops calls:

1. `registerFilters({ timeDateFormat, markupOut })` — once. `timeDateFormat`
   is the configured date format string, `markupOut` the output directory
   (project-relative).
2. `registerTags(getOutputDir)` — once. `getOutputDir` is a function returning
   the absolute output directory; call it at render time, not registration
   time.
3. A series of `setGlobal(key, value)` calls: `package` (the project's parsed
   `package.json`), `site` (the `markup.site` object), data file globals,
   reactor-rendered HTML, and `nav` (the navigation tree). Globals are
   re-set on every compile; `removeGlobal(key)` clears ones whose source file
   disappeared.

Then, for every page, Poops awaits `render(templateName, context)`.

## Required interface

| Member | Kind | Contract |
|---|---|---|
| `constructor(templatesDir, includePaths, options)` | — | See lifecycle above. |
| `markupExtensions` | getter → string | Pipe-separated extension list used to glob page sources, e.g. `'html|xml|rss|atom|json|njk|md'`. No dots. |
| `indexableExtensions` | getter → `Set` | Dot-prefixed extensions eligible for collections, search index and nav, e.g. `new Set(['.html', '.md'])`. |
| `registerFilters(opts)` | method | Register template filters. Called once. |
| `registerTags(getOutputDir)` | method | Register template tags/extensions. Called once. |
| `setGlobal(key, value)` | method | Set a template global. Called repeatedly, across compiles. |
| `removeGlobal(key)` | method | Remove a template global. |
| `render(templateName, context)` | method, awaited | Render one page template to an HTML string. `templateName` is the page's source path; `context` carries `page`, `site`, collections and pagination. |

## Optional interface

Each of these is feature-detected with a `typeof` check — implement what your
engine can support, skip the rest.

| Member | Contract | Without it |
|---|---|---|
| `invalidate(file)` | Drop cached compiled template(s) backed by `file` — a changed or deleted path; prefix-match to cover deleted directories. Presence signals your cache survives across compiles. | Poops calls `clearCache()` (if present) on every watch compile. |
| `clearCache()` | Wipe the whole compiled-template cache. Only used when `invalidate` is absent. | No cache management at all. |
| `pagesDependingOn(file)` | Return the page paths whose last render loaded `file` — powers incremental rebuilds: only affected pages re-render on a partial/layout edit. | Any markup edit triggers a full markup compile. |
| `replaceOutExtensions(outputPath)` | Remap the output filename's extension when your engine's source extension differs from the emitted one. | Poops's default extension mapping applies. |
| `isMarkupSource(absPath)` | Claim a file the glob wouldn't classify as markup (engine-specific source formats), so watch routes its changes to the markup pipeline. | Only `markupExtensions` matches count. |

`renderString` and `fileExtension` exist on the builtin engines but the
pipeline never calls them — don't rely on them, don't feel obliged to
implement them.

## Reference implementations

The builtin engines are the contract's living documentation:

- [`lib/markup/engines/nunjucks.js`](https://github.com/stamat/poops/blob/main/lib/markup/engines/nunjucks.js)
  — the full-featured one: cache proxy feeding a dependency index
  (`pagesDependingOn`), targeted `invalidate`, front matter and Markdown
  handling in a custom loader.
- [`lib/markup/engines/liquid.js`](https://github.com/stamat/poops/blob/main/lib/markup/engines/liquid.js)
  — the smaller one; start here when writing your own.

A practical skeleton:

```js
export default class MyEngine {
  constructor(templatesDir, includePaths, options) { /* set up */ }

  get markupExtensions() { return 'html|md|mytpl' }
  get indexableExtensions() { return new Set(['.html', '.md', '.mytpl']) }

  registerFilters({ timeDateFormat, markupOut }) { /* filters */ }
  registerTags(getOutputDir) { /* tags */ }
  setGlobal(key, value) { /* globals */ }
  removeGlobal(key) { /* globals */ }

  async render(templateName, context) {
    return '<html>…</html>'
  }
}
```
