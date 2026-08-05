---
layout: poops-docs-theme/docs
title: Poops vs Vite
navTitle: vs Vite
description: Vite's HMR, hashed assets and plugin ecosystem against one JSON file that also builds the site — where each one wins, and when to take Vite.
order: 1
keywords: ["vite", "rolldown", "hmr", "comparison", "bundler", "esbuild"]
---

# Poops vs Vite

Vite is the default answer, and for an app it usually still is. The reason to look elsewhere shows
up on the other kind of project: a marketing site, a blog, a docs site, a WordPress theme. There the
work is SCSS, a bit of TypeScript, some pages with front matter — and Vite gives you a JavaScript
config file, a plugin for Markdown, another for the sitemap, and a framework on top to turn any of
it into HTML.

Poops covers that project with one JSON file. It does not cover Vite's project — see the bottom of
this page before you migrate anything.

## What each one is

Vite 8 [shipped in March 2026](https://vite.dev/blog/announcing-vite8) with
[Rolldown](https://rolldown.rs), a Rust bundler, replacing the old esbuild-in-dev, Rollup-in-prod
split — one bundler for both, with the plugin API preserved. It is a dev server and a build tool for
applications; HTML output beyond `index.html` is a job for a framework or a plugin.

Poops is a bundler ([esbuild](https://esbuild.github.io/)), a Sass compiler
([Dart Sass](https://sass-lang.com/dart-sass)), a PostCSS pipeline and a Jekyll-inspired site
generator, all driven from `poops.json`. Eighteen direct dependencies, forty-one packages installed,
Node ≥ 22.

## Feature by feature

| | Poops | Vite |
| --- | --- | --- |
| Config | `poops.json` — no JS, no imports, no plugin objects | `vite.config.ts` — JavaScript you run |
| Dev server | static files + SSE; **CSS is swapped in place**, everything else is a full page reload | native ESM, **HMR** with module-level updates |
| Dev/prod parity | one code path — dev serves what the build wrote | dev is unbundled ESM, prod is bundled; differences are rare but real |
| Bundler | esbuild | Rolldown (Rust) |
| Build speed | not benchmarked here | Rolldown is Vite's headline number — [InfoQ reports builds up to 30× faster](https://www.infoq.com/news/2026/05/vite-v8-rust/); that figure is Vite's own, measured against Vite, not against Poops |
| Sass | built in, plus [design-token JSON imports](../quick-start/transpiling-css) | install `sass`, Vite handles the rest |
| PostCSS / Tailwind | a separate `postcss` key, so it does not run twice | built in |
| Markdown, front matter, layouts | built in — Nunjucks or Liquid | plugin, or a framework |
| Collections, taxonomies, pagination, RSS | built in | no |
| Sitemap, `robots.txt`, `llms.txt`, search index, nav tree, JSON-LD | built in | plugins, if they exist |
| Hashed filenames, asset manifest, HTML rewriting | **no — you write the paths, they stay as written** | yes, automatic |
| Code splitting | esbuild's own: `"splitting": true` with `"format": "esm"` and a directory `out`, which emits a hashed chunk per dynamic import — nothing rewrites your HTML or emits preload hints | managed, with preload directives |
| Plugin ecosystem | **none** | very large — the strongest reason to pick Vite |
| Framework SPAs (React, Vue, Svelte) | React via `scripts` and `reactor`; no framework HMR | first-class for all of them |
| Library builds (IIFE + ESM + CJS from one source) | yes, [three entries in the config](../quick-start/transpiling-js) | yes, `build.lib` |

## The same site, in each

A blog with SCSS, a bit of TypeScript, Markdown posts, a feed and a sitemap. In Poops that is the
whole config:

```json
{
  "markup": { "in": "src/markup", "out": "dist", "options": {
    "sitemap": "sitemap.xml",
    "feed": { "collection": "blog", "out": "feed.rss" }
  }},
  "styles": [{ "in": "src/scss/index.scss", "out": "dist/css/styles.css", "options": { "minify": true } }],
  "scripts": [{ "in": "src/js/main.ts", "out": "dist/js/main.js", "options": { "minify": true, "format": "iife" } }],
  "watch": ["src"],
  "livereload": true
}
```

In Vite it is `vite.config.ts` plus a Markdown plugin, a front-matter convention, a sitemap plugin
and an RSS script — or a framework on top that brings all four and its own model with them. Vite's
answer is better once the site becomes an app; it is more moving parts while the site is a site.

## The honest losses

**No HMR.** Poops' live reload is an EventSource that swaps a changed stylesheet in place — the page
does not reload for CSS, and scroll and state survive. Any other change reloads the page. Editing a
React component with a filled-in form ten fields deep is exactly as annoying as that sounds.

**No content hashing, no managed chunk graph.** Nothing rewrites your HTML, so `styles.css` stays
`styles.css`. Cache-bust with a query string, a versioned directory, or your CDN's rules. Splitting
itself works — esbuild's `splitting` option passes through and emits hashed chunks for dynamic
imports — but you get chunks in a directory, not a manifest, preload hints or `<script>` tags
written for you. Size is not the constraint here; wiring is.

**No plugin API, ever.** [CONTRIBUTING.md](https://github.com/stamat/poops/blob/main/CONTRIBUTING.md)
says a feature that can be a few lines of config does not get an extension point. That keeps the
dependency list boring and the config learnable in an afternoon; it also means when Poops does not
do a thing, you cannot add it from outside. You can, however, [write a markup engine](../engine-api)
— the one interface that is deliberately open.

## Use Poops when

- The output is a site. Size is not the line — esbuild bundles thousands of lines as happily as fifty; what you give up is HMR and a managed chunk graph, not headroom.
- The pages, the styles and the scripts should be one config, one command, plain files at the end.
- You are bolting a front end onto WordPress, Laravel or Rails and want [asset paths and nothing else](../quick-start/frameworks) — no dev-server middleware, no manifest to read from PHP.
- Config in JSON is a feature: nothing executes to tell you what your build does, and the [`$schema`](../config-reference) makes the editor complete it.

## Use Vite when

- You are building an application, not a site — HMR while you work on component state is worth more than any of this.
- You want hashed assets and a manifest without thinking about it.
- You depend on a plugin nobody is going to reimplement — MDX, legacy browser polyfills, an image pipeline you already tuned.
- Your framework's toolchain is Vite (SvelteKit, Nuxt, Astro, Remix). Fighting that costs more than it saves.
