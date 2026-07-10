---
layout: post
title: PostCSS Pipeline & Tailwind CSS Support
date: 2026-03-07
description: Poops now has a general-purpose PostCSS pipeline. Use any PostCSS plugin — including Tailwind CSS v4 — alongside or instead of the Sass pipeline.
published: true
---

### What's new?

Poops now supports an optional `postcss` config key that lets you process CSS files through [PostCSS](https://postcss.org/) with any plugins you want. The most obvious use case is [Tailwind CSS](https://tailwindcss.com/), but it works with any PostCSS plugin — Autoprefixer, cssnano, postcss-preset-env, you name it.

### Getting started

Install PostCSS and whatever plugins you need:

```bash
npm i -D postcss @tailwindcss/postcss tailwindcss
```

Add a `postcss` entry to your `poops.json`:

```json
{
  "postcss": {
    "in": "src/css/main.css",
    "out": "dist/css/main.css",
    "options": {
      "plugins": ["@tailwindcss/postcss"],
      "minify": true
    }
  }
}
```

Your CSS entry file just imports Tailwind:

```css
@import "tailwindcss";
```

Then use utility classes in your markup templates. Tailwind v4 auto-detects content sources, so no config file is needed.

### How it works

The PostCSS pipeline runs **after** Styles (Sass) and Markups in the build order. This matters because PostCSS plugins like Tailwind need to scan the compiled HTML to know which utility classes are actually used.

In watch mode, PostCSS is re-triggered whenever Styles or Markups recompile — so adding a new class to a template automatically regenerates the CSS.

### Plugin configuration

Plugins can be specified as simple strings or as tuples with options:

```json
{
  "options": {
    "plugins": ["@tailwindcss/postcss", ["autoprefixer", { "grid": true }]]
  }
}
```

### Using Sass and Tailwind together

The Sass and PostCSS pipelines are independent. If you want both, keep them writing to separate output files:

```json
{
  "styles": {
    "in": "src/scss/main.scss",
    "out": "dist/css/main.css"
  },
  "postcss": {
    "in": "src/css/tailwind.css",
    "out": "dist/css/tailwind.css",
    "options": {
      "plugins": ["@tailwindcss/postcss"]
    }
  }
}
```

If you want PostCSS to post-process Sass output (e.g. add vendor prefixes with Autoprefixer), point `postcss.in` to the Sass output file and `postcss.out` to a different path — so the original Sass output is preserved for re-processing on subsequent builds.

### Try it

A working Tailwind example is included in the repo:

```bash
node poops.js -c example-tailwind/poops.json
```
