---
layout: poops-docs-theme/docs
title: Poops vs Astro, Hugo & Next
navTitle: vs Astro, Hugo & Next
description: Three frameworks that do more than Poops on purpose — islands, content layers, server rendering — and the size of site where doing less is the point.
order: 4
keywords: ["astro", "hugo", "next.js", "islands", "ssr", "static site generator", "comparison"]
---

# Poops vs Astro, Hugo & Next

This page is the one where Poops loses most of the rows, and that is the correct result. Astro,
Hugo and Next are frameworks: they own the project, they bring a mental model, and in exchange they
solve problems Poops does not attempt — partial hydration, content layers, server rendering,
ten-thousand-page builds.

Poops attempts fewer things so that the config stays one file you can read in a sitting. The
question is not which is more capable. It is whether you need the capability enough to rent the
model.

## Where the three stand

| | Latest, read August 2026 | Runtime | Shape |
| --- | --- | --- | --- |
| [Astro](https://astro.build/blog/whats-new-july-2026/) | 7.x, released June 2026 | Node | component framework with islands, content collections, optional SSR |
| [Hugo](https://github.com/gohugoio/hugo/releases) | 0.164.x, July 2026 | a single Go binary | template-driven SSG, no Node needed |
| [Next.js](https://nextjs.org/blog) | 16.2.x, with 15.5.x in maintenance | Node | full-stack React framework — SSR, ISR, API routes |
| Poops | 2.x | Node ≥ 22 | bundler + SSG behind one JSON file |

## Feature by feature

| | Poops | Astro | Hugo | Next |
| --- | --- | --- | --- | --- |
| Config | one JSON file | `astro.config.mjs` + integrations | `hugo.toml`, plus Go templates | `next.config.js` + conventions |
| Language you write pages in | Nunjucks, Liquid, Markdown | `.astro`, MDX, any UI framework | Go templates, Markdown | React |
| Bundling | esbuild, in the same config | Vite | [`js.Build`, backed by esbuild](https://gohugo.io/functions/js/build/) | Turbopack/webpack, hidden |
| Sass | Dart Sass, built in | built in | [Dart Sass, built in](https://gohugo.io/functions/css/sass/) | plugin |
| Partial hydration / islands | [`reactor`](../static-site/react-components) — pre-render a component, hydrate it yourself, one entry each | **islands as the core model**, per-component `client:` directives | no client framework model | React Server Components |
| Server rendering, ISR, API routes | **no**, static files only | yes, optional | no | yes, that is the point |
| Content collections with schemas | front matter collections, no schema validation | typed content collections, live collections since 6 | page bundles, taxonomies | your choice of library |
| MDX | no | yes | no | yes |
| Image optimisation | [`poops-images`](https://github.com/stamat/poops-images), optional peer | built in | built in | built in |
| Build speed at thousands of pages | **unmeasured — do not take a claim here** | fast, Vite-based | the reference for this, Go and parallel | slower, more work per page |
| Deploy target | any static host | static host, or a server | any static host | a Node host, or a platform adapter |
| Learning surface | the config keys | components, islands, integrations, adapters | Go templates and Hugo's lookup order | React, routing conventions, rendering modes |

## One interactive component, concretely

Astro's `client:visible` is one word on a component. The Poops equivalent is a `reactor` entry —
pre-render the component to HTML at build time, inject it into the template, ship a hydration
bundle for it:

```json
{
  "reactor": [{
    "component": "src/js/Counter.jsx",
    "inject": "counter_html",
    "in": "src/js/counter-hydrate.jsx",
    "out": "dist/js/counter.js",
    "options": { "minify": true }
  }]
}
```

The template drops it in with `{% raw %}{{ counter_html | safe }}{% endraw %}` and the page ships that
component's JavaScript and nothing else — [the full walkthrough](../static-site/react-components) is
three files long. For one or two components this is less machinery than a framework. For twenty it
is twenty entries, and Astro's one word is the better trade.

## What Poops wins

**Nothing to learn beyond the keys.** No islands directives, no template lookup order, no rendering
modes, no adapters, no `.astro` file format. The config is JSON, the
[config reference](../config-reference) is the whole API, and `$schema` completes it in the editor.

**No framework in the output.** A Poops page is the HTML your template produced, plus whatever
script tags you wrote. Nothing hydrates a page you did not ask to hydrate, there is no client router
to hit a bug in, and no rendering-model migration lands in your inbox next year.

**The assets are in the same file as the pages.** SCSS, TypeScript, PostCSS, images and pre-rendered
React are keys beside `markup` — not integrations, not adapters, not a Vite config you inherit from
the framework and have to reason about through two layers.

**Static output that goes anywhere.** `dist` on any host, `file://` included, because
[the default path prefixes are relative](../deploying). No adapter per platform, no Node process to
keep alive.

## What each wins outright

**Astro** — islands as the model. If half your pages need interactive components and the other half
must ship zero JavaScript, `client:visible` beats twenty `reactor` entries. Poops' version is the
same idea hand-wired, and hand-wiring does not scale past a handful.

**Hugo** — scale and portability. One binary, no `node_modules`, and it is what people reach for at
thousands of pages. Poops has never been measured at that size, and this page will not pretend
otherwise.

**Next** — anything with a server in it. Sessions, ISR, API routes, streaming. Poops writes files to
a directory and exits; if you need a request handler, nothing here helps.

## Which to pick

| If | Pick |
| --- | --- |
| Interactive components on content pages, with the JavaScript kept off the pages that do not need it | Astro |
| Thousands of pages, fast builds, no Node in the pipeline | Hugo |
| A server, authentication, or data that changes per request | Next |
| A content site with SCSS and TypeScript, a handful of interactive pieces at most, and one config file holding all of it | Poops |
