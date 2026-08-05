---
layout: poops-docs-theme/docs
title: Poops vs webpack, Rollup & Parcel
navTitle: vs webpack, Rollup & Parcel
description: The config-weight comparison — loaders, plugin chains and zero-config magic against one JSON file, and the jobs where the older bundlers still win outright.
order: 2
keywords: ["webpack", "rollup", "parcel", "rspack", "loaders", "plugins", "comparison", "config"]
---

# Poops vs webpack, Rollup & Parcel

The webpack config that nobody on the team can read is a genre. It starts as twenty lines, acquires
a loader for Sass, a loader for the loader, a plugin to extract the CSS the loaders just inlined, a
`resolve.alias` block, and a comment saying *do not touch this, it took a day*. Two years later the
project is a landing page with a contact form, and the toolchain has more dependencies than the
site has pages.

Poops is the reaction to that: `in`, `out`, options — and no place for that config to grow into.

## Where the three stand

All read from npm in August 2026:

| | Latest | Notes |
| --- | --- | --- |
| [webpack](https://www.npmjs.com/package/webpack) | 5.109.x | actively maintained; the [2026 roadmap](https://webpack.js.org/blog/2026-02-04-roadmap-2026/) targets native CSS support, built-in TypeScript and a path to webpack 6 |
| [Rollup](https://www.npmjs.com/package/rollup) | 4.62.x | frequent releases; still the reference for library bundling, and the plugin API Rolldown kept |
| [Parcel](https://www.npmjs.com/package/parcel) | 2.16.x | zero-config by design; last release six months before this page was written |
| [Rspack](https://rspack.rs) | 2.x | not compared here — a Rust, webpack-compatible bundler, and the thing to look at if the reason you are reading this page is *webpack is slow* |

## Feature by feature

| | Poops | webpack | Rollup | Parcel |
| --- | --- | --- | --- | --- |
| Config | one JSON file | `webpack.config.js`, loaders + plugins | `rollup.config.js`, plugins | none for the common case |
| Learning surface | the keys in [the config reference](../config-reference) | loaders, rules, plugins, resolve, optimization | plugin lifecycle hooks | its conventions, when you need to leave them |
| Escape hatch | esbuild options pass through | a loader or plugin | a plugin | a `.parcelrc` transformer |
| Sass | built in | `sass-loader` + `css-loader` + `MiniCssExtractPlugin` | a plugin | built in |
| PostCSS / Tailwind | own config key | `postcss-loader` | a plugin | built in |
| HTML pages, layouts, front matter | built in, Nunjucks or Liquid | `html-webpack-plugin`, one page at a time | no | entry HTML, no templating |
| Collections, taxonomies, RSS, sitemap, search index | built in | no | no | no |
| Content hashing + HTML rewriting | **no** | yes | via plugins | yes |
| Code splitting | esbuild's `splitting` — hashed chunks, but no manifest and no HTML rewriting | yes, `SplitChunksPlugin` | yes, and precise | yes |
| Module federation | **no** | yes — its own territory | no | no |
| Tree-shaken library output | esbuild's, three entries for IIFE/ESM/CJS | yes | **the best of the four** for this | yes |
| Dev experience | rebuild + reload; CSS swapped in place | dev server with HMR | plugin-provided watch | dev server with HMR |
| Dependencies you install | 18 direct, 41 packages | webpack + cli + loaders + plugins | rollup + plugins | parcel |

## The same job, spelled out

Bundle a TypeScript entry, compile SCSS beside it, minify both, keep sourcemaps on the unminified
twin. In webpack that is `ts-loader` (or `babel-loader` plus a preset), `sass-loader` →
`css-loader` → `MiniCssExtractPlugin.loader`, a `rules` array to wire them to extensions, the plugin
in `plugins`, and `optimization.minimizer` for the CSS half. In Poops it is the file itself:

```json
{
  "scripts": [{
    "in": "src/js/main.ts",
    "out": "dist/js/main.js",
    "options": { "minify": true, "sourcemap": true, "format": "iife", "target": "es2019" }
  }],
  "styles": [{
    "in": "src/scss/index.scss",
    "out": "dist/css/styles.css",
    "options": { "minify": true, "sourcemap": true }
  }]
}
```

Both emit `main.js` + `main.min.js` and `styles.css` + `styles.min.css`. The difference is that the
second one has no loader order to get wrong, and the `$schema` reference at the top of the file
makes the editor complete every key — a typo is caught as you type it rather than at build time.

Add `"markup"` and the same file also builds the pages, which is the part webpack, Rollup and Parcel
were never trying to do.

## The part Poops refuses

There is no plugin API and there will not be one. A feature that fits in a few lines of config does
not get an extension point, and one that does not fit gets argued about in an issue instead. That
refusal is the whole design: it is why the dependency list is boring, why the config is JSON, and
why there is no version of this project where you write a `poops.config.js` that imports four
packages.

The cost is real and it is exactly webpack's strength: **when Poops does not do something, you
cannot bolt it on.** A custom transform for a file type nobody has heard of is a loader in webpack
and a fork in Poops — or a [markup engine](../engine-api), which is the one interface left open,
because a template language is a whole job rather than a hook.

## Use webpack, Rollup or Parcel when

| If | Use | Why |
| --- | --- | --- |
| You need module federation or a micro-frontend split | webpack | Nothing else here does it |
| You publish a library and want the smallest, cleanest ESM output with precise external control | Rollup | It has been the reference for a decade, and Poops' esbuild output is fine but blunter |
| You want zero config for an app with many asset types | Parcel | Its conventions cover more file types than Poops does |
| The existing config works and nobody is fighting it | leave it | A migration you do not need is a bug you introduce |
| webpack is only *slow* | Rspack, or Vite | Both are drop-in-ish and Rust-fast; Poops is a different tool, not a faster webpack |

## Use Poops when

- The project is a site with a front end: pages, SCSS and TypeScript in one config, one command, plain files out.
- The build should be readable by whoever picks the project up next year — including you. JSON, no imports, with `$schema` completing the keys in the editor.
- You want the toolchain to be one dependency instead of a bundler plus five loaders plus three plugins that have to agree on versions.
- Nobody on the team wants to own a `webpack.config.js` again.

The size of the JavaScript is not the deciding factor — esbuild handles large bundles fine. What
decides it is whether you need managed chunks, a manifest and federation, or whether you need the
config to stay small enough to read.
