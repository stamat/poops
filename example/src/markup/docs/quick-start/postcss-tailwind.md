---
layout: docs
title: PostCSS & Tailwind
navTitle: PostCSS & Tailwind
description: Run any PostCSS plugin — including Tailwind CSS v4 and Autoprefixer — as a pipeline separate from Sass.
order: 6
keywords: ["postcss", "tailwind", "autoprefixer", "css", "plugins"]
---

# PostCSS & Tailwind

The `postcss` key runs a [PostCSS](https://postcss.org/) pipeline. It is **separate** from the
Sass `styles` pipeline — use it for [Tailwind CSS](https://tailwindcss.com/),
[Autoprefixer](https://github.com/postcss/autoprefixer), or any other PostCSS plugin.

> [!WARNING]
> PostCSS and its plugins are **not** bundled with Poops. Install what you use in your own project:
> `npm i -D postcss @tailwindcss/postcss tailwindcss`.

## Shape

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

- **`in` / `out`** — input and output CSS files.
- **`options.plugins`** — array of plugin names. Each is a string, or a tuple `["name", { opts }]`.
- **`options.minify` / `options.justMinified`** — same behaviour as the other pipelines.

Pass options to a plugin with the tuple form:

```json
{
  "postcss": {
    "in": "src/css/main.css",
    "out": "dist/css/main.css",
    "options": { "plugins": [["autoprefixer", { "grid": true }]] }
  }
}
```

## Tailwind CSS v4

Install the deps, then your entry CSS just imports Tailwind:

```css
@import "tailwindcss";
```

Config:

```json
{
  "postcss": {
    "in": "src/css/main.css",
    "out": "dist/css/main.css",
    "options": { "plugins": ["@tailwindcss/postcss"], "minify": true }
  },
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "includePaths": ["_layouts", "_partials"]
  },
  "watch": ["src"]
}
```

Then use Tailwind utility classes in your markup. Tailwind v4 auto-detects content sources, so no
`tailwind.config.js` is required.

> [!INFO]
> **Build order matters.** PostCSS runs *after* Styles and Markups. That is deliberate — Tailwind
> scans the compiled HTML for utility classes, so the markup must exist first. In watch mode,
> editing a template re-triggers the PostCSS pass.

## Sass and Tailwind together

Keep them as two pipelines writing to two files: Sass compiles your `.scss`, PostCSS handles
Tailwind independently. They don't need to chain.

If you *do* want PostCSS to post-process the Sass output (say, Autoprefixer over compiled Sass),
point `postcss.in` at the Sass output file and `postcss.out` at a **different** file so the
original isn't overwritten mid-build.

> [!TIP]
> Most projects want either Sass *or* Tailwind, not both. Reach for the `styles` pipeline for
> authored SCSS, and the `postcss` pipeline for utility-first Tailwind.

Next: [React](react).
