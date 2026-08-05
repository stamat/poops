---
layout: poops-docs-theme/docs
title: Poops vs Jekyll & Eleventy
navTitle: vs Jekyll & Eleventy
description: The same front matter, layouts and collections — without Ruby, and with the bundler in the same config instead of alongside it.
order: 3
keywords: ["jekyll", "eleventy", "11ty", "static site generator", "ssg", "liquid", "nunjucks", "comparison"]
---

# Poops vs Jekyll & Eleventy

Poops is Jekyll-inspired and says so: front matter, `_layouts`, collections, a `_data` directory,
pagination. If you know Jekyll, most of [Building pages](../static-site/pages) will read as familiar.

The difference is what happens when the site needs a stylesheet and thirty lines of TypeScript.
With Jekyll or Eleventy that is a second toolchain — a bundler, its config, two watch processes and
a script whose only job is sequencing two tools that do not know about each other. With Poops it is
two more keys in the file you already have:

```json
{
  "markup": { "in": "src/markup", "out": "dist" },
  "styles": [{ "in": "src/scss/index.scss", "out": "dist/css/styles.css" }],
  "scripts": [{ "in": "src/js/main.ts", "out": "dist/js/main.js" }],
  "watch": ["src"],
  "livereload": true
}
```

One command builds all three, one watcher rebuilds whichever changed, and the page reloads once.

## Where the three stand

| | Poops | Jekyll | Eleventy |
| --- | --- | --- | --- |
| Latest, read August 2026 | 2.x | [4.4.1, released 29 Jan 2025](https://rubygems.org/gems/jekyll/versions/4.4.1) | [3.1.6](https://www.npmjs.com/package/@11ty/eleventy) |
| Runtime | Node ≥ 22 | Ruby ≥ 2.7, Bundler, a Gemfile | Node ≥ 18 |
| Install | 18 direct dependencies, 41 packages | gems | 28 direct dependencies |
| Templating | Nunjucks or Liquid, plus Markdown — swappable, and [a custom engine is an interface](../engine-api) | Liquid | a buffet: Nunjucks, Liquid, Markdown, JS, and more |
| Front matter, layouts, includes, data files | yes | yes | yes |
| Collections, taxonomies, pagination | yes | yes | yes |
| RSS | built in | plugin | plugin |
| **JS/TS bundling** | **built in, esbuild** | **no** | **no** — [`eleventy-plugin-vite`](https://github.com/11ty/eleventy-plugin-vite) or your own |
| **Sass** | **built in, Dart Sass** | `jekyll-sass-converter` — [3.x runs Dart Sass through `sass-embedded`](https://github.com/jekyll/jekyll-sass-converter) after libsass was dropped | **no** — [`addExtension` plus your own `sass` install](https://www.11ty.dev/docs/languages/custom/) |
| PostCSS / Tailwind | own pipeline key | separate toolchain | separate toolchain |
| Responsive images | [`poops-images`](https://github.com/stamat/poops-images), an optional peer package | plugin | plugin |
| Sitemap, search index, nav tree, `llms.txt`, JSON-LD | built in | plugins | plugins |
| React components pre-rendered into pages | [`reactor`](../static-site/react-components) | no | not built in |
| Plugin ecosystem | **none** — the features above are config keys instead | large, and old | large, and active |
| Themes you can install | one — [`poops-docs-theme`](https://github.com/stamat/poops-docs-theme) | many, gem-packaged | many |
| Built by GitHub Pages without a workflow | no — [run a workflow](../deploying) | **yes**, branch sources are built with Jekyll | no |

## What Poops wins

**The asset side is not a second project.** SCSS, TypeScript, PostCSS, responsive images and
pre-rendered React components are keys in the same file as the pages. On the other two, each of
those is a plugin with its own conventions, or a bundler running beside the site generator with its
own config, its own watcher and its own failure mode when the two disagree about output paths.

**No Ruby, no gems.** No Gemfile, no `bundle exec`, no native extension that stops compiling on a
new OS release. `npm i -D poops` and the toolchain is one package.

**The machine-readable output is config, not five plugins.** [`sitemap.xml`, `robots.txt`,
`llms.txt`, a search index, a nav tree and JSON-LD](../config-reference) are keys with defaults —
one convention to learn instead of five, and nothing to keep in step when one of them stops being
maintained.

**Live reload that keeps your place.** A changed stylesheet is swapped into the page in dev; scroll
and state survive. Both of the others reload the page.

## What Jekyll and Eleventy still win

**Ecosystem and answers.** A decade of themes, plugins and an existing answer for the thing you are
stuck on. Poops has this site and one maintainer.

**Eleventy's template flexibility.** It renders whatever you throw at it and lets you write data
files and shortcodes as plain JavaScript. Poops gives you two engines and
[an interface for a third](../engine-api) — enough for most sites, and plainly less.

**Jekyll on GitHub Pages with no CI at all.** Push Markdown to a branch, GitHub builds it. Poops
needs [a workflow](../deploying) — twenty lines, but twenty lines more than nothing.

**Ruby, if your team writes Ruby.** A Jekyll site in a Rails shop is one language for everybody.

## Which to pick

| If | Pick |
| --- | --- |
| The site needs SCSS, TypeScript or images as much as it needs pages, and you want one config for all of it | Poops |
| The site is Markdown and layouts with no assets to build, and GitHub should build it for free | Jekyll |
| You want maximum template freedom and a plugin for everything, and do not mind assembling the asset side | Eleventy |
| You already have a working site of either kind and no complaints | keep it — a migration you do not need is a bug you introduce |

Decided? The concept-by-concept mappings, including the parts with no equivalent, are in
[Migrating from Jekyll](../migrating-from-jekyll) and
[Migrating from Eleventy](../migrating-from-eleventy).
