---
layout: docs
title: Introduction
navTitle: Introduction
description: Poops is a Jekyll-inspired static site builder — and a no-bullshit bundler and transpiler for the web.
order: 0
keywords: ["poops", "bundler", "static site generator", "transpiler", "esbuild", "sass"]
---

# 💩 Poops

**Poops is a straightforward, no-bullshit bundler for the web** — and a bit more than that.
On the surface it takes input and output paths and poops out bundled files. Underneath it is
three tools in one:

- a **bundler & transpiler** for JavaScript/TypeScript and SCSS/Sass,
- a **PostCSS pipeline** (so Tailwind and friends work),
- and a **Jekyll-inspired static site generator** with templating, collections, images, search and navigation.

If you have ever fought Webpack config, watched Rollup plugins rot, or wondered why a "simple"
setup needs fifteen dependencies — Poops is the antidote. One JSON config, sane defaults,
minimal learning curve.

> [!TIP]
> In a hurry? Jump to the [Quick Start](quick-start/) and have something building in a minute.

## Why another bundler?

Gulp is abandoned. Parcel hates config files. Rollup and Webpack are heavy for simple tasks.
Poops exists to do one boring thing well: **give it an `in` and an `out`, get bundled files back.**
It leans on the fastest tools available — [esbuild](https://esbuild.github.io/) for JS/TS and
[Dart Sass](https://sass-lang.com/dart-sass) for styles — and stays out of your way.

## What it is

Poops is a Jekyll-inspired static site builder. Like Jekyll, you write templates and content,
drop in some front matter, and get a static site. Unlike Jekyll, it is also the bundler for your
JS and CSS, it runs on Node, and it uses modern transpilers under the hood.

You configure everything in a single `poops.json` (or `💩.json`) file. Each top-level key is a
pipeline you can opt into or ignore:

| Key | What it does |
| --- | --- |
| `scripts` | Bundle & transpile JS/TS/JSX/TSX with esbuild |
| `styles` | Compile SCSS/Sass with Dart Sass |
| `postcss` | Run a PostCSS pipeline (Tailwind, Autoprefixer, …) |
| `markup` | Generate HTML from Nunjucks/Liquid/Markdown templates |
| `reactor` | Pre-render React components to HTML at build time |
| `images` | Optimize & generate responsive image variants |
| `copy` | Copy static files into the output |
| `serve` / `livereload` / `watch` | Local dev server with live reload |

> [!NOTE]
> Everything is optional except that you need at least one of `scripts`, `styles`, `postcss` or
> `markup`. No input, no poop. 💩

## What it is not

Poops is not a plugin ecosystem. There is no plugin API to learn, no `poops.config.js` with
callbacks. If a feature isn't built in, you compose it from the pipelines above (for example,
PostCSS for Tailwind) or you contribute it. That constraint is the point — the config stays
small and readable.

## Who it's for

Poops is a niche tool, not a general-purpose framework. It earns its keep in three spots:

- **The anti-config build.** A marketing page or a couple of static templates with some SCSS
  doesn't need a `webpack.config.js` or a dozen Vite plugins. One JSON block, `in` and `out`,
  done.
- **Design-token-driven micro-sites.** Poops reads the W3C [DTCG](https://www.designtokens.org/)
  format natively and turns Figma-exported token JSON into SCSS variables — no separate Style
  Dictionary or Gulp pipeline. Useful for design-system docs and standalone component libraries.
- **Static sites with just enough React.** Write the site in Nunjucks or Liquid, then drop in
  one or two interactive React components (a calculator, a filter UI) via the `reactor`
  pipeline's zero-config SSR and hydration. SEO-friendly HTML, without the footprint of a full
  React framework.

## Where it has zero value

- **Large SPAs.** No React Fast Refresh, no granular code splitting, no plugin ecosystem. Reach
  for Next.js or Vite instead.
- **Non-React component frameworks.** Vue, Svelte, Solid — not supported, not planned.
- **Mission-critical enterprise infrastructure.** Poops is maintained by one person as a side
  project. That's fine for a brochure site; think twice before betting production revenue on it.

> [!NOTE]
> If you're not sure whether Poops fits, the litmus test is size: small static site or design
> system docs, yes; full application, no.

## Install

Globally:

```bash
npm i -g poops
```

or per-project:

```bash
npm i -D poops
```

> [!TIP]
> For the fastest possible start, clone the template repo
> [💩🌪️ Shitstorm](https://github.com/stamat/shitstorm) and start editing.

Ready? Head to the [Quick Start](quick-start/).
