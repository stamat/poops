# 💩 Poops [![npm version](https://img.shields.io/npm/v/poops)](https://www.npmjs.com/package/poops) [![build status](https://github.com/stamat/poops/actions/workflows/ci.yml/badge.svg)](https://github.com/stamat/poops/actions/workflows/ci.yml) [![license](https://img.shields.io/github/license/stamat/poops.svg)](https://github.com/stamat/poops/blob/main/LICENSE)

Straightforward, no-bullshit bundler for the web.

> When your day is long
>
> And the night, the night is yours alone
>
> When you're sure you've had enough
>
> Of these bundlers, well hang on
>
> Don't let yourself go
>
> 'Cause everybody poops
>
> Everybody poops sometimes

[R.E.M. - Everybody Poops :poop:](https://www.youtube.com/watch?v=5rOiW_xY-kc)

---

Intuitive with a minimal learning curve and minimal docs, utilizing the most efficient transpilers and compilers available (like [dart-sass](https://sass-lang.com/dart-sass) and [esbuild](https://esbuild.github.io/)) Poops aims to be the simplest bundler option there is. If it's not, please do contribute so we can make it so! 🙏 All ideas and contributions are welcome.

It uses a simple config file where you define your input and output paths and it poops out your bundled files. Simple as that.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Scripts](#scripts)
    - [JSX/TSX (React) Example](#jsxtsx-react-example)
  - [Reactor (React Pre-rendering)](#reactor-react-pre-rendering)
  - [Styles](#styles)
    - [Design Tokens](#design-tokens)
  - [PostCSS (optional)](#postcss-optional)
    - [Tailwind CSS Example](#tailwind-css-example)
  - [Markups](#markups)
    - [Nunjucks vs Liquid](#nunjucks-vs-liquid)
    - [Custom Engines](#custom-engines)
    - [Collections & Pagination](#collections--pagination)
    - [Taxonomies (Tags & Categories)](#taxonomies-tags--categories)
    - [Custom Tags](#custom-tags)
      - [image](#image)
      - [googleFonts](#googlefonts)
      - [highlight](#highlight)
    - [Custom Filters](#custom-filters)
    - [Search Index, Sitemap, llms.txt, robots.txt & Navigation](#search-index-sitemap-llmstxt-robotstxt--navigation)
  - [Images (optional)](#images-optional)
  - [Copy](#copy)
  - [Banner (optional)](#banner-optional)
  - [Local Server (optional)](#local-server-optional)
  - [Live Reload (optional)](#live-reload-optional)
  - [Watch (optional)](#watch-optional)
  - [Include Paths (optional)](#include-paths-optional)
- [Why?](#why)

## Features

- Bundles SCSS/SASS to CSS
- Uses [dart-sass](https://sass-lang.com/dart-sass) for SCSS/SASS bundling
- Design token support — import JSON tokens (W3C DTCG & Style Dictionary) as SCSS variables or maps
- PostCSS pipeline — use any PostCSS plugin including [Tailwind CSS](https://tailwindcss.com/)
- Bundles JS/TS/JSX/TSX to IIFE/ESM/CJS
- Uses [esbuild](https://esbuild.github.io/) for bundling and transpiling JS/TS/JSX/TSX to IIFE/ESM/CJS
- React pre-rendering (Reactor) — renders React components to HTML at build time for static sites with optional hydration
- Optional JS and CSS minification using [esbuild](https://esbuild.github.io/)
- Can produce minified code simultaneously with non-minified code! (cause I always forget to minify my code for production)
- Supports source maps only for non minified - non production code (optional)
- Supports multiple input and output paths
- Resolves node modules
- Can add a templatable banner to output files (optional)
- Static site generation with swappable template engines: [Nunjucks](https://mozilla.github.io/nunjucks/) (default) or [Liquid](https://liquidjs.com/) — with blogging option (optional)
- Collections with pagination, and taxonomies — tags/categories as paginated, crawlable landing pages (with localizable labels)
- Has a configurable local server (optional)
- Rebuilds on file changes (optional)
- Live reloads on file changes (optional)

## Quick Start

> For a superfast start, you can use the Poops template repository: [💩🌪️Shitstorm](https://github.com/stamat/shitstorm)

You can install Poops globally:

```bash
npm i -g poops
```

or locally:

```bash
npm i -D poops
```

If you have installed Poops globally, create a `poops.json` or `💩.json` configuration file in the project root (see [Configuration](#configuration) on how to configure) and run:

`poops` or `💩`

or pass a custom config. This is useful when you have multiple environments:

`poops yourAwesomeConfig.json` or `💩 yourAwesomeConfig.json`

**CLI Options:**

| Flag                         | Short | Description                                          |
| ---------------------------- | ----- | ---------------------------------------------------- |
| `--build`                    | `-b`  | Build the project and exit                           |
| `--config <path>`            | `-c`  | Specify the config file                              |
| `--port <number>`            | `-p`  | Specify the server port, overrides config            |
| `--livereload-port <number>` | `-l`  | Specify the livereload port, overrides config        |
| `--base-url <path>`          | `-u`  | Set the base URL prefix for markup, overrides config |

The `--base-url` flag is particularly useful for CI/CD pipelines where the deploy path may differ per environment:

```bash
poops --build --base-url /blog
```

If you have installed Poops locally you can run it with `npx poops` or `npx 💩` or add a script to your `package.json`:

```json
{
  "scripts": {
    "build": "npx poops" // or "npx 💩"
  }
}
```

## Configuration

Configuring Poops is simple 😌. Let's presume that we have a `example/src/scss` and `example/src/js` directories and we want to bundle the files into `example/dist/css` and `example/dist/js`. If you also have markup files, you can use [Nunjucks](https://mozilla.github.io/nunjucks/) (default) or [Liquid](https://liquidjs.com/) templating engine to generate HTML files from your templates. Let's presume that we have a `example/src/markup` directory and we want to generate HTML files in the root of the your directory.

Just create a `poops.json` file in the root of your project and add the following (you can see this sample config in this repo's root):

```json
{
  "scripts": [
    {
      "in": "example/src/js/main.ts",
      "out": "example/dist/js/scripts.js",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false,
        "format": "iife",
        "target": "es2019"
      }
    }
  ],
  "reactor": [
    {
      "component": "example/src/js/App.jsx",
      "inject": "app_html",
      "in": "example/src/js/app-hydrate.jsx",
      "out": "example/dist/js/app-hydrate.js",
      "options": {
        "minify": true,
        "target": "es2019"
      }
    }
  ],
  "styles": [
    {
      "in": "example/src/scss/index.scss",
      "out": "example/dist/css/styles.css",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false
      }
    }
  ],
  "markup": {
    "engine": "nunjucks",
    "in": "example/src/markup",
    "out": "/",
    "site": {
      "title": "Poops",
      "description": "A super simple bundler for simple web projects."
    },
    "data": ["data/links.json", "data/poops.yaml"],
    "includePaths": ["_layouts", "_partials"]
  },
  "copy": [
    {
      "in": "example/src/static",
      "out": "example/dist"
    }
  ],
  "banner": "/* {{ name }} v{{ version }} | {{ homepage }} | {{ license }} License */",
  "serve": {
    "port": 4040,
    "base": "/"
  },
  "livereload": true,
  "watch": ["src"],
  "includePaths": ["node_modules"]
}
```

All config properties are optional except `scripts`, `styles`, `postcss` or `markups`. You have to specify at least one of them. If you don't have anything to consume, you won't poop. 💩

You can freely remove the properties that you don't need. For example, if you don't want to run a local server, just remove the `serve` property from the config.

### Scripts

Scripts are bundled with [esbuild](https://esbuild.github.io/). Supports `.js`, `.ts`, `.jsx`, and `.tsx` files out of the box — including React and other JSX frameworks. You can specify multiple scripts to bundle. Each script has the following properties:

- `in` - the input path, can be a file path, an array of file paths, or a glob pattern (e.g. `"src/js/*.js"`). Globs must use `/` separators (even on Windows)
- `out` - the output path, can be a directory or a file path. With multiple inputs it must be a directory — entry points from different directories nest their output under the common ancestor (esbuild's `outbase`)
- `options` - the options for the bundler. You can apply most of the esbuild options that are not in conflict with Poops. See [esbuild's options](https://esbuild.github.io/api/#build-api) for more info.

**Options:**

- `sourcemap` - whether to generate sourcemaps or not, sourcemaps are generated only for non-minified files since they are useful for debugging. Default is `false`. This is a direct esbuild option
- `minify` - whether to minify the output or not, minification is performed by `esbuild` and is only applied to non-minified files. Default is `false`
- `justMinified` - whether you want to have a minified file as output only. Removes the non-minified file from the output. Useful for production builds. Default is `false`
- `format` - the output format, can be `iife` or `esm` or `cjs` - this is a direct esbuild option
- `target` - the target for the output, can be `es2018` or `es2019` or `es2020` or `esnext` for instance - this is a direct esbuild option
- `jsx` - the JSX transform mode, can be `transform` (default) or `automatic`. Use `automatic` for React 17+ JSX runtime which doesn't require importing React in every file - this is a direct esbuild option

`scripts` property can accept an array of script configurations or just a single script configuration. If you want to bundle multiple scripts, just add them to the `scripts` array:

```json
{
  "scripts": [
    {
      "in": "src/js/main.ts",
      "out": "dist/js/scripts.js",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false,
        "format": "iife",
        "target": "es2019"
      }
    },
    {
      "in": "src/js/other.ts",
      "out": "dist/js/other.js",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false,
        "format": "iife",
        "target": "es2019"
      }
    }
  ]
}
```

#### JSX/TSX (React) Example

To bundle a React app, just point `in` to your `.jsx` or `.tsx` entry file:

```json
{
  "scripts": [
    {
      "in": "src/js/app.jsx",
      "out": "dist/js/app.js",
      "options": {
        "minify": true,
        "format": "iife",
        "jsx": "automatic"
      }
    }
  ]
}
```

Setting `jsx` to `automatic` uses React's JSX runtime (React 17+), so you don't need `import React from 'react'` in every file. If you omit `jsx` or set it to `transform`, the classic `React.createElement` transform is used.

As noted earlier, if you don't want to bundle scripts, just remove the `scripts` property from the config.

### Reactor (React Pre-rendering)

The `reactor` config key defines React components that are pre-rendered to HTML at build time (SSG) and optionally hydrated on the client. This is a separate pipeline from `scripts` — reactor entries have their own build step, watcher path, and logging tag.

Each reactor entry has the following properties:

- `component` — the file that default-exports a React component (rendered at build time with `renderToString`)
- `inject` — template global variable name for the rendered HTML (available in both Nunjucks and Liquid)
- `in` (optional) — client entry file for hydration (bundled for the browser)
- `out` (optional) — output path for the client bundle
- `options` (optional) — esbuild options for the client bundle (same as script entries: `minify`, `format`, `target`, `sourcemap`, etc.)

```json
{
  "reactor": [
    {
      "component": "src/js/App.jsx",
      "inject": "app_html",
      "in": "src/js/app-hydrate.jsx",
      "out": "dist/js/app-hydrate.js",
      "options": {
        "minify": true,
        "target": "es2019"
      }
    }
  ]
}
```

For backwards compatibility, `"ssg"` is also accepted as a config key — it is treated as an alias for `"reactor"`.

In your templates, use the `inject` name to insert the rendered HTML:

```html
<div id="root">{{ app_html | safe }}</div>
<script src="js/app-hydrate.min.js"></script>
```

If you only need server-side rendering without client hydration, omit `in` and `out`:

```json
{
  "reactor": [
    {
      "component": "src/js/App.jsx",
      "inject": "app_html"
    }
  ]
}
```

**How it works:**

1. Poops bundles the component with `react-dom/server` for Node.js and calls `renderToString`
2. The rendered HTML is stored and made available as a template global variable
3. If `in`/`out` are specified, the client entry is bundled for the browser
4. At runtime, React hydrates the pre-rendered HTML, making it interactive

Poops does not need `react` or `react-dom` as its own dependency — they are resolved from your project's `node_modules`. In watch mode, changes to files in the reactor component's directory trigger re-rendering and client re-bundling. Markup is recompiled only when the rendered output actually changes. Changes to other JS/TS files only trigger the scripts pipeline — the two are independent.

**Note:** If you don't need server-side pre-rendering, you can bundle a React app entirely through the regular `scripts` pipeline — just point `in` to your `.jsx`/`.tsx` entry file and use `createRoot` on the client. The `reactor` config is only needed when you want build-time HTML rendering with optional hydration.

### Styles

Styles are bundled with [Dart Sass](https://sass-lang.com/dart-sass). You can specify multiple styles to bundle. Each style has the following properties:

- `in` - the input path, can be a file path, an array of file paths, or a glob pattern (e.g. `"src/scss/*.scss"`). Globs must use `/` separators (even on Windows) and skip Sass partials (`_*.scss`). Each matched file is compiled separately
- `out` - the output path, can be a directory or a file path. With multiple inputs it must be a directory — each input compiles to `<out>/<basename>.css`, so inputs sharing a basename (e.g. `a/main.scss` and `b/main.scss`) will overwrite each other
- `options` - the options for the bundler.

**Options:**

- `sourcemap` - whether to generate sourcemaps or not, sourcemaps are generated only for non-minified files since they are useful for debugging. Default is `false`
- `minify` - whether to minify the output or not, minification is performed by `esbuild`. Default is `false`
- `justMinified` - whether you want to have a minified file as output only. Removes the non-minified file from the output. Useful for production builds. Defaults to `false`.
- `tokenPaths` - a string or array of directory paths containing JSON design token files. Enables the [`sass-token-importer`](https://github.com/stamat/sass-token-importer) which lets you `@use` JSON tokens directly in SCSS. Supports [W3C DTCG](https://design-tokens.github.io/community-group/format/) and [Style Dictionary](https://amzn.github.io/style-dictionary/) formats with auto-detection.
- `tokenOutput` - output mode for design tokens: `"variables"` (default) generates flat SCSS variables, `"map"` generates nested Sass maps.
- `resolveAliases` - whether to resolve `{path.to.token}` alias references in design tokens. Default is `true`.

`styles` property can accept an array of style configurations or just a single style configuration. If you want to bundle multiple styles, just add them to the `styles` array:

```json
{
  "styles": [
    {
      "in": "src/scss/main.scss",
      "out": "dist/css/styles.css",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false
      }
    },
    {
      "in": "src/scss/other.scss",
      "out": "dist/css/other.css",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false
      }
    }
  ]
}
```

#### Design Tokens

You can import JSON design token files directly into your SCSS using the `token:` prefix. Define your tokens in JSON once and use them as SCSS variables — no manual variable files to keep in sync.

Given a token file `src/tokens/colors.json`:

```json
{
  "color": {
    "$type": "color",
    "primary": { "$value": "#0066cc" },
    "secondary": { "$value": "#ff6600" },
    "link": { "$value": "{color.primary}" }
  }
}
```

Add `tokenPaths` to your styles config:

```json
{
  "styles": [
    {
      "in": "src/scss/index.scss",
      "out": "dist/css/styles.css",
      "options": {
        "tokenPaths": ["src/tokens"]
      }
    }
  ]
}
```

Then use the `token:` prefix in your SCSS:

```scss
@use "token:colors" as c;

.btn {
  color: c.$color-primary;
}
.btn:hover {
  color: c.$color-secondary;
}
a {
  color: c.$color-link; // resolved from {color.primary} → #0066cc
}
```

For Sass maps instead of flat variables, set `"tokenOutput": "map"`:

```scss
@use "sass:map";
@use "token:colors" as c;

.btn {
  color: map.get(c.$color, primary);
}
```

As noted earlier, if you don't want to bundle styles, just remove the `styles` property from the config.

### PostCSS (optional)

Process CSS files with [PostCSS](https://postcss.org/) and any PostCSS plugins. This is a separate pipeline from Styles (Sass) — use it for tools like [Tailwind CSS](https://tailwindcss.com/), [Autoprefixer](https://github.com/postcss/autoprefixer), or any other PostCSS plugin.

PostCSS and its plugins are **not** bundled with Poops. You need to install them in your project:

```bash
npm i -D postcss
```

Each PostCSS entry has the following properties:

- `in` - the input CSS file path
- `out` - the output path, can be a directory or a file path
- `options` - options for the pipeline

**Options:**

- `plugins` - an array of PostCSS plugin names to load. Each entry can be a string (plugin name) or a tuple `["plugin-name", { options }]` for passing options to the plugin.
- `minify` - whether to minify the output using `esbuild`. Default is `false`
- `justMinified` - output only the minified file. Default is `false`

`postcss` property can accept an array of configurations or a single configuration:

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

You can also pass options to plugins using the tuple form:

```json
{
  "postcss": {
    "in": "src/css/main.css",
    "out": "dist/css/main.css",
    "options": {
      "plugins": [["autoprefixer", { "grid": true }]]
    }
  }
}
```

**Build order:** PostCSS runs after Styles and Markups in the build pipeline. This means PostCSS plugins can reference the compiled markup output (e.g. Tailwind scanning HTML for utility classes). In watch mode, PostCSS is re-triggered after Styles or Markups recompile.

#### Tailwind CSS Example

Install the deps, then use a config like this:

```bash
npm i -D postcss @tailwindcss/postcss tailwindcss
```

```json
{
  "postcss": {
    "in": "src/css/main.css",
    "out": "dist/css/main.css",
    "options": {
      "plugins": ["@tailwindcss/postcss"],
      "minify": true
    }
  },
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "site": {
      "title": "Poops + Tailwind",
      "description": "A Tailwind CSS example for Poops"
    },
    "includePaths": ["_layouts", "_partials"]
  },
  "serve": { "port": 4040, "base": "/dist" },
  "livereload": true,
  "watch": ["src"]
}
```

The CSS entry file (`src/css/main.css`) simply imports Tailwind:

```css
@import "tailwindcss";
```

Then use Tailwind utility classes directly in your markup templates. Tailwind v4 auto-detects content sources, so no `tailwind.config.js` is needed.

**Using Sass + Tailwind together:** If you want both Sass and Tailwind, keep them as separate pipelines writing to separate output files. The Sass pipeline compiles `.scss` to CSS, while the PostCSS pipeline handles Tailwind independently. They don't need to chain into each other unless you want PostCSS to post-process the Sass output (e.g. with Autoprefixer) — in that case, point `postcss.in` to the Sass output file and `postcss.out` to a different file so the original Sass output is preserved for re-processing.

### Markups

- `engine` (optional) - the template engine to use. Can be `"nunjucks"` (default) or `"liquid"`. [Nunjucks](https://mozilla.github.io/nunjucks/) is a Mozilla template engine inspired by Jinja2. [Liquid](https://liquidjs.com/) is a Shopify-compatible template engine. Both engines support the same tags, filters, collections, search index, sitemap, and navigation tree features documented below.
- `in` - the input path, can be a directory or a file path, but please just use it as a directory path for now. All files in this directory will be processed and the structure of the directory will be preserved in the output directory with exception to directories that begin with an underscore `_` will be ignored.
- `out` - the output path, can be only a directory path (for now)
- `site` (optional) - global data that will be available to all templates in the markup directory. Like site title, description, social media links, etc. You can then use this data in your templates `{{ site.title }}` for instance.
- `data` (optional) - is an array of JSON or YAML data files, that once loaded will be available to all templates in the markup directory. If you provide a path to a file for instance `links.json` with a `facebook` property, you can then use this data in your templates `{{ links.facebook }}`. The base name of the file will be used as the variable name, with spaces, dashes and dots replaced with underscores. So `the awesome-links.json` will be available as `{{ the_awesome_links.facebook }}` in your templates. The root directory of the data files is `in` directory. So if you have a `data` directory in your `in` directory, you can specify the data files like this `data: ["data/links.json"]`. The same goes for the YAML files.
- `includePaths` - an array of paths to directories that will be added to the template engine's include paths. Useful if you want to separate template partials and layouts. For instance, if you have a `_includes` directory with a `header.njk` (or `header.liquid`) partial that you want to include in your markup, you can add it to the include paths and then include the templates like this `{% include "header.njk" %}`, without specifying the full path to the partial.
- `baseURL` (optional) - a base URL prefix to use instead of relative path prefixes. When set, `{{ relativePathPrefix }}` will always resolve to this value (with a trailing slash ensured) instead of being computed relative to each page's depth. Useful when deploying under a subdirectory (e.g. `"/blog"` for `domain.com/blog/`). When not set, relative prefixes (`./`, `../`, etc.) are used, which work for any deployment location including subdirectories and `file://` URLs.

**💡 NOTE:** If, for instance, you are building a simple static onepager for your library, and want to pass a version variable from your `package.json`, Poops automatically reads your `package.json` if it exists in your working directory and sets the global variable `package` to the parsed JSON. So you can use it in your markup files, for example like this: `{{ package.version }}`.

**"Edit this page on GitHub" links.** Every page exposes `page.filePath` — its source file path relative to your project root, with posix separators (e.g. `src/markup/docs/index.md`). That is exactly the path GitHub's editor expects, so an edit link is one line in your layout:

```nunjucks
{% set repoUrl = site.repo or package.homepage %}
{% if page.filePath and repoUrl %}
<a href="{{ repoUrl }}/edit/{{ site.branch or 'main' }}/{{ page.filePath }}">✏️ Edit this page on GitHub</a>
{% endif %}
```

Put `repo` and `branch` in your `site` data (they fall back to `package.homepage` and `main`). Don't rebuild the path from `page.url` — that is the output URL (`.html`, and `index.md` collapses to a directory), so it can't be reversed to the `.md` source.

Here is a sample markup configuration using the default Nunjucks engine:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "site": {
      "title": "My Awesome Site",
      "description": "This is my awesome site"
    },
    "data": ["data/links.json", "data/other.yaml"],
    "includePaths": ["_includes"],
    "baseURL": "/blog"
  }
}
```

To use Liquid instead, set the `engine` property:

```json
{
  "markup": {
    "engine": "liquid",
    "in": "src/liquid",
    "out": "dist",
    "site": {
      "title": "My Awesome Site",
      "description": "This is my awesome site"
    },
    "data": ["_data/links.json", "_data/other.yaml"],
    "includePaths": ["_layouts", "_partials"]
  }
}
```

If your project doesn't have markups, you can remove the `markup` property from the config entirely. No code will be executed for this property.

#### Nunjucks vs Liquid

Both engines support the same feature set (collections, pagination, search index, sitemap, navigation tree, custom tags, and filters). The main differences are in template syntax:

| Feature        | Nunjucks                      | Liquid                                |
| -------------- | ----------------------------- | ------------------------------------- |
| File extension | `.njk`                        | `.liquid`                             |
| Inheritance    | `{% extends "base.html" %}`   | `{% layout "base.liquid" %}`          |
| Default values | `{{ x or "fallback" }}`       | `{{ x \| default: "fallback" }}`      |
| Contains check | `{% if "x" in items %}`       | `{% if items contains "x" %}`         |
| Safe output    | `{{ html \| safe }}`          | `{{ html }}` (no escaping by default) |
| Includes       | `{% include "partial.njk" %}` | `{% render "partial.liquid" %}`       |

Both engines process `.html` and `.md` files in addition to their native extension.

#### Templates from an npm package

Layouts and partials can live in an installed package, so a shared theme ships as a dependency instead of copied files. Reference it by package name — any include/extend name containing a `/` is resolved from `node_modules`:

```nunjucks
{% extends "my-theme/layout.html" %}
{% block content %}
  <h1>{{ page.title }}</h1>
{% endblock %}
```

Or from front matter, so the page carries no template syntax:

```yaml
---
layout: my-theme/layout
---
```

A theme package must:

- **Not restrict subpaths with `exports`** — or map its templates explicitly, e.g. `"exports": { "./*": "./*" }`. Otherwise Node blocks resolving the `.html` files by path.
- **Reference its own partials relatively** — `{% import "./nav.html" as nav %}`, not the bare name. A bare name (no `/`) is always searched in the consumer's project only, never the package.

Bundled filters (`toc`, `breadcrumb`, `og`, `canonical`, …) are engine-global, so package templates use them with no extra wiring.

Liquid resolves package templates the same way — `node_modules` is on its include roots, so `{% layout "my-theme/layout.liquid" %}` and `{% render "my-theme/partial.liquid" %}` resolve by package name too (a Liquid theme ships `.liquid` files). The `exports`/relative-partial rules above apply the same, except containment is by include root rather than the `/` name gate.

#### Custom Engines

The `engine` option also accepts a module specifier — an npm package name or a path relative to your project root. The module's default export must be an engine class:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "engine": "poops-shopify"
  }
}
```

An engine class implements this contract (see [`lib/markup/engines/`](lib/markup/engines/) for the two built-in reference implementations):

```js
export default class MyEngine {
  constructor(templatesDir, includePaths, options) {} // options: { autoescape }
  get fileExtension() {
    return ".liquid";
  } // native template extension
  get indexableExtensions() {
    return new Set([".html"]);
  } // extensions eligible for search index/nav
  get markupExtensions() {
    return "html|liquid|md";
  } // glob alternation of processed extensions
  registerFilters({ timeDateFormat, markupOut }) {}
  registerTags(getOutputDir) {}
  setGlobal(key, value) {}
  removeGlobal(key) {}
  async render(templatePath, context) {
    return "html";
  } // templatePath is an absolute file path
  async renderString(source, context) {
    return "html";
  }
}
```

Optionally, an engine may implement `replaceOutExtensions(outputPath)` to control how source extensions map to output extensions (the default maps `.md`/`.njk`/`.liquid` to `.html`).

The easiest starting point is extending a built-in engine — deep imports are intentionally supported for this:

```js
import LiquidEngine from "poops/lib/markup/engines/liquid.js";

export default class MyEngine extends LiquidEngine {
  registerFilters(opts) {
    super.registerFilters(opts);
    this.engine.registerFilter("shout", (str) => String(str).toUpperCase());
  }
}
```

#### Collections & Pagination

Collections turn a directory of pages into a sorted, optionally paginated list — blog posts, changelog entries, documentation. A collection maps to a direct subdirectory of your markup `in` directory: every `.html`, `.njk`, `.liquid` or `.md` file inside it (except the `index.*` file) becomes a collection item.

There are two ways to declare a collection:

**1. Front matter auto-discovery** — add `collection` to the front matter of the directory's index file:

```yaml
---
title: Changelog
collection: true
paginate: 10
sort: date
---
```

`collection: true` uses the directory name as the collection name; a string (e.g. `collection: changelog`) names it explicitly. `paginate` and `sort` are optional.

**2. Config** — list collections in the markup config. The name must match a subdirectory of `in`:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "collections": [
      "changelog",
      {
        "name": "blog",
        "paginate": 5,
        "sort": { "by": "title", "order": "asc" }
      }
    ]
  }
}
```

**Sorting.** By default items are sorted by `date`, newest first. `sort` can be a field name shorthand (`"sort": "title"`) or an object `{ "by": "field", "order": "asc" | "desc" }`. Sorting by `date` compares dates (default order `desc`); any other field compares alphabetically (default order `asc`).

**Items.** Each item exposes its own front matter plus properties Poops adds:

- `url` - the item's output path relative to the site root (e.g. `changelog/my-post.html`)
- `title` - falls back to the file name if not set in front matter
- `date` - falls back to the file's modification time if not set, with a build warning. Set a real `date` in front matter — mtime is meaningless on CI checkouts (git clone resets it), so undated posts will reshuffle between deploys.
- `wordcount`, `excerpt` (first paragraph, plain text — a meta-description fallback), `fileName`, `filePath`, `collection`

An item with `published: false` in its front matter is excluded from the collection and its page is not built.

**Using collections in templates.** Every collection is available as a global variable named after it, on every page:

```nunjucks
{% for post in changelog.items %}
  <a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a> — {{ post.date | date }}
{% endfor %}
```

**Pagination.** With `paginate: N` set, the collection's index file is rendered once per page of N items: page 1 to `out/changelog/index.html`, page 2 to `out/changelog/2/index.html`, and so on. Inside the index template the collection object carries the page state:

| Variable                    | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `pageItems`                 | the items on the current page                           |
| `pageNumber` / `totalPages` | current page (1-based) / total page count               |
| `pageUrl`                   | URL of the current page (`changelog`, `changelog/2`, …) |
| `nextPage` / `nextPageUrl`  | next page number / URL, `null` on the last page         |
| `prevPage` / `prevPageUrl`  | previous page number / URL, `null` on the first page    |

From the example site's `changelog/index.html`:

```nunjucks
{% for post in changelog.pageItems %}
  <div class="post">
    <h2><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></h2>
    <div class="date">{{ post.date | date }}</div>
    {{ post.description }}
  </div>
{% endfor %}

{% if changelog.totalPages > 1 %}
  {% if changelog.nextPageUrl %}<a href="{{ relativePathPrefix }}{{ changelog.nextPageUrl }}">Next</a>{% endif %}
  {{ changelog.pageNumber }} of {{ changelog.totalPages }}
  {% if changelog.prevPageUrl %}<a href="{{ relativePathPrefix }}{{ changelog.prevPageUrl }}">Previous</a>{% endif %}
{% endif %}
```

Or use the `{% pagination %}` shorthand tag (available in both engines), which renders Previous/Next links and a "page of total" counter — with `relativePathPrefix` applied — and outputs nothing when there is only one page:

```nunjucks
{% pagination changelog %}
```

Pages 2..N automatically get a distinct `<title>` — `Changelog — Page 2` — so paginated pages don't all share the landing page's title (and its `og`/`jsonld` metadata). Page 1 keeps its own title.

**Localizing the labels.** The `— Page N` title suffix and the `{% pagination %}` tag's `Previous`/`Next`/`of` wording default to English. Override them site-wide under `site.pagination`:

```json
{
  "markup": {
    "site": {
      "pagination": {
        "title": "{title} — Seite {n}",
        "prev": "Zurück",
        "next": "Weiter",
        "of": "von"
      }
    }
  }
}
```

`title` accepts `{title}`, `{n}` and `{total}` tokens and applies to pages 2..N (and taxonomy term pages); `prev`/`next`/`of` localize the `{% pagination %}` tag (`{n} of {total}` → `{n} von {total}`).

Item pages themselves are compiled like any other markup file, preserving the directory structure: `src/markup/changelog/my-post.md` → `dist/changelog/my-post.html`. A collection directory without an index file still builds its items and exposes the collection to templates — only the paginated listing pages are skipped.

#### Taxonomies (Tags & Categories)

A **taxonomy** turns a front-matter field (tags, categories, authors) into its own paginated, crawlable landing page per term — `changelog/tag/feature/`, `blog/category/release/`. Declare which fields become taxonomies on the collection, alongside `paginate`/`sort` — either in the index front matter or the config entry:

```yaml
---
title: Changelog
collection: true
paginate: 10
taxonomies:
  - name: tags # front-matter field to group on
    path: tag # URL segment (defaults to name); "tag" for a singular URL
    paginate: 5 # per-term page size (defaults to the collection's paginate)
---
```

Shorthand: a bare string list (`taxonomies: [tags, category]`) uses each field name as the URL segment and inherits the collection's `paginate`. Array-valued fields split per element — a post with `tags: [js, css]` lands under **both** `tag/js/` and `tag/css/`. Terms are slugified for the URL (`Static Site` → `static-site`).

Term pages render with the **collection's own index template** — no extra file. On a term page the collection object carries the term context; branch on `activeTerm` to render a term view:

```nunjucks
{% if changelog.activeTerm %}
  <h1>Tagged {{ changelog.activeTerm | humanize }}</h1>
  {% for post in changelog.pageItems %}
    <a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a>
  {% endfor %}
  {% pagination changelog %}
{% endif %}
```

On a term page `items`/`pageItems` are scoped to that term (so `pagination` and `groupby` narrow to it too); `activeTaxonomy` holds the URL segment and `activeTermSlug` the slug. Build tag links anywhere from `collection.taxonomies`:

```nunjucks
{% for tax in changelog.taxonomies %}
  {% for term in tax.terms %}
    <a href="{{ relativePathPrefix }}{{ term.url }}">{{ term.term | humanize }} ({{ term.count }})</a>
  {% endfor %}
{% endfor %}
```

Each term exposes `term`, `slug`, `url`, `count` and `totalPages`.

Term pages get a distinct `<title>` and `og`/`jsonld` metadata (`Tag: Feature`, paged `Tag: Feature — Page 2`), and the `breadcrumb`/`jsonld` filters resolve them to a **Home › Collection › Tag: Term** trail automatically (skipping the non-page `tag`/`category` URL segment). The `Tag:`/`Category:` label comes from `path`, so it localizes by naming the path in your language (`path: etiqueta` → `Etiqueta: …`). Term pages are listed in the sitemap but kept out of the search index and nav.

#### Custom Tags

##### image

Poops can generate responsive `<img>` elements with `srcset` attributes. Image processing (resize, format conversion) is handled externally — Poops discovers the generated variants on disk and produces the correct HTML markup.

**Naming convention:** Your image tool should output variants as `{name}-{width}w.{ext}`. For example, given `photo.jpg`, the expected variants are: `photo-320w.jpg`, `photo-640w.jpg`, `photo-320w.webp`, `photo-640w.webp`, etc.

**`{% image %}` tag** — generates a full `<img>` element:

Nunjucks:

```nunjucks
{% image 'static/photo.jpg', alt='Hero', class='hero-img', sizes='(max-width: 640px) 100vw, 50vw' %}
```

Liquid:

```liquid
{% image 'static/photo.jpg', alt: 'Hero', class: 'hero-img', sizes: '(max-width: 640px) 100vw, 50vw' %}
```

Output:

```html
<img
  src="static/photo-640w.jpg"
  srcset="
    static/photo-320w.webp 320w,
    static/photo-640w.webp 640w,
    static/photo-960w.webp 960w
  "
  sizes="(max-width: 640px) 100vw, 50vw"
  alt="Hero"
  class="hero-img"
  loading="lazy"
/>
```

- Scans the output directory for files matching `{name}-{width}w.{ext}`
- Groups by format, prefers `avif` > `webp` > original format for srcset
- Uses the middle-sized variant as `src` fallback
- Prepends `relativePathPrefix` automatically
- Defaults: `sizes="100vw"`, `loading="lazy"`
- Falls back to a plain `<img src="...">` if no variants are found

**Named crops with `size`** — pass a `size` kwarg to build the `<img>` from a named crop/resize group instead of the default responsive widths. The whole group becomes its own srcset (each crop has its own aspect ratio), so a square thumbnail set, a wide banner set, etc. each get correct `srcset`/`width`/`height`:

```nunjucks
{% image 'static/photo.jpg', size='thumb', alt='', sizes='240px' %}
```

```html
<img
  src="static/photo-thumb-480w.webp"
  srcset="static/photo-thumb-480w.webp 480w, static/photo-thumb.webp 960w"
  width="480"
  height="480"
  sizes="240px"
  alt=""
  loading="lazy"
/>
```

This requires the [poops-images](https://github.com/stamat/poops-images) compile cache (named-size widths are read from it). The `size` name matches a named entry in your `images.sizes` config. The largest member of the group is written without a width suffix (`photo-thumb.webp`) — poops still srcsets it at its real width from the cache.

**[poops-images](https://github.com/stamat/poops-images) integration:** if a `.poops-images-cache.json` compile cache is found in the output directory (poops-images writes one next to the images it generates), Poops reads variants from it instead of scanning the directory. On top of the scan behavior above, the cache gives you:

- `width` and `height` attributes on the `<img>` element (exact dimensions from the cache — prevents layout shift). Pass your own `width`/`height` kwargs to override.
- Correct `src` when the source format was converted (e.g. `photo.heic` → `photo.jpg`), even when there are no size variants.
- By default the srcset is built only from the plain `{name}-{width}w.{ext}` width variants. Named sizes (`photo-thumb-480w.webp`) and preprocessed outputs (`photo-blurred-640w.jpg`) are kept out of it — they are crops and effects with their own aspect ratios. Reach a named crop group on purpose with the `size` kwarg above (or the `srcset` filter's second argument).
- EXIF metadata via the `exif` filter (see below).

##### googleFonts

Generates Google Fonts `<link>` tags with preconnect hints. Accepts an array of font names (strings) or font objects with weight/italic options.

Nunjucks (supports inline arrays):

```nunjucks
{% googleFonts ["Open Sans", "Roboto"] %}
```

Liquid (pass a variable — inline arrays are not supported in Liquid syntax):

```liquid
{% googleFonts fonts %}
```

Where `fonts` is defined in a data file (e.g. `fonts.json`):

```json
["Open Sans", "Roboto"]
```

Output:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Open+Sans&family=Roboto&display=swap"
  rel="stylesheet"
/>
```

With specific weights and italics (Nunjucks):

```nunjucks
{% googleFonts ["DM Sans", {name: "Poppins", weights: [400, 700], ital: true}] %}
```

With specific weights and italics (Liquid — via data file):

```json
["DM Sans", { "name": "Poppins", "weights": [400, 700], "ital": true }]
```

Font object options:

- `name` — font family name
- `weights` — array of weight values (e.g. `[400, 700]`)
- `ital` — set to `true` to include italic variants
- `display` — font-display strategy, defaults to `swap` (Nunjucks only, as a keyword argument)

##### highlight

Syntax-highlights code blocks at build time using [highlight.js](https://highlightjs.org/), eliminating layout shift caused by client-side highlighting. Code is pre-highlighted in the HTML output — you only need the highlight.js CSS theme on the client, not the JS.

**`{% highlight %}` tag** — wraps a code block with syntax highlighting (same syntax in both engines):

```
{% highlight 'javascript' %}
const greet = (name) => {
  return `Hello, ${name}!`;
};
{% endhighlight %}
```

Output:

```html
<pre><code class="hljs language-javascript"><span class="hljs-keyword">const</span> greet = <span class="hljs-function">...</span></code></pre>
```

The language argument is optional. If omitted, highlight.js will attempt to auto-detect the language.

**Markdown code fences** are also highlighted automatically at build time:

````md
```json
{ "name": "poops" }
```
````

Registered languages: `javascript`/`js`, `typescript`/`ts`, `css`, `scss`, `html`, `xml`, `json`, `bash`/`sh`, `shell`, `python`/`py`, `ruby`/`rb`, `php`, `java`, `c`, `cpp`, `csharp`/`cs`, `go`, `rust`/`rs`, `yaml`/`yml`, `markdown`/`md`, `sql`, `diff`.

#### Custom Filters

All filters are available in both engines. The only syntax difference is how arguments are passed: Nunjucks uses parentheses `| filter("arg")`, Liquid uses a colon `| filter: "arg"`.

- `slugify` — slugifies a string. Usage: `{{ "My Awesome Title" | slugify }}` will output `my-awesome-title`

- `humanize` — the inverse of `slugify`: turns a slug or raw term into a display label. Usage: `{{ "static-site" | humanize }}` will output `Static Site`

- `jsonify` — serializes a value to JSON. Usage: `{{ myObject | jsonify }}`

- `markdown` — renders a markdown string to HTML with GitHub Flavored Markdown extras: emoji shortcodes (e.g. `:rocket:` → 🚀), alert callouts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`, `[!INFO]`) and footnotes (`[^1]`). Code fences are syntax-highlighted and headings get slug `id`s plus permalink anchors. Usage: `{{ "**bold** :rocket:" | markdown }}`

- `date` — formats a date string. Uses [dayjs](https://day.js.org/) format tokens. A default format can be set via the `timeDateFormat` config option.
  - Nunjucks: `{{ "2024-01-15" | date("MMMM D, YYYY") }}`
  - Liquid: `{{ "2024-01-15" | date: "MMMM D, YYYY" }}`

- `concat` — returns a new array with the value appended (does not mutate the original):
  - Nunjucks: `{{ items | concat("c") }}`
  - Liquid: `{{ items | concat: "c" }}`

- `push` — appends a value to an array in place (mutates the original):
  - Nunjucks: `{{ items | push("c") }}`
  - Liquid: `{{ items | push: "c" }}`

- `svg` — reads an SVG file and injects it inline. The path is resolved relative to the project root. Returns empty string if the file doesn't exist or isn't an SVG. Usage: `{{ 'src/icons/logo.svg' | svg }}`

- `highlight` — syntax-highlights a code string at build time using highlight.js. Takes an optional language argument. If the language is omitted, highlight.js will auto-detect it. Returns a `<pre><code class="hljs">` block with highlighted markup.
  - Nunjucks: `{{ someCodeVariable | highlight('javascript') }}`
  - Liquid: `{{ someCodeVariable | highlight: 'javascript' }}`

- `og` — generates Open Graph (and a Twitter card) `<meta>` tags from a page's front matter and your `site` data, for link previews on social/chat platforms. Put it in your layout `<head>`. `og:type` auto-detects: `article` when the page has a `date`, otherwise `website`.
  - Nunjucks: `{{ page | og(site) }}`
  - Liquid: `{{ page | og: site }}`

  Emits `og:title`, `og:description` (a missing `description` falls back to the page's auto-`excerpt`, then `site.description`), `og:type`, `og:url` (made absolute with `site.url`), `og:site_name` (from `site.title`), `og:locale` (`page.lang`/`site.lang`), `og:image` (`page.image`/`site.image`, made absolute), and `twitter:card` (`summary_large_image` when there's an image, else `summary`). For articles it adds `article:published_time`, `article:modified_time` and `article:author`. Attribute values are escaped. Set an `og` object in front matter to add or override any tag (e.g. `og:image:alt`, a fixed `twitter:card`):

  ```yaml
  ---
  title: My post
  date: 2026-01-01
  image: static/cover.jpg
  og:
    "og:image:alt": Cover illustration
  ---
  ```

- `canonical` — generates a `<link rel="canonical">` tag pointing at a page's authoritative absolute URL (`site.url` + the page's `url`), the dedup signal that stops query-string and duplicate URLs splitting your ranking. Put it in your layout `<head>`. Front matter `canonical` overrides the target — an absolute URL as-is, or a path resolved against `site.url` (for cross-domain or hand-picked canonicals). The homepage canonicals to the site root. Returns nothing without `site.url`.
  - Nunjucks: `{{ page | canonical(site) }}`
  - Liquid: `{{ page | canonical: site }}`

- `jsonld` — generates a schema.org JSON-LD `<script type="application/ld+json">` block from a page's front matter and your `site` data, for GEO (Generative Engine Optimization) and structured data. Put it in your layout `<head>`. The `@type` auto-detects: `BlogPosting` when the page has a `date`, otherwise `WebPage`.
  - Nunjucks: `{{ page | jsonld(site) }}`
  - Liquid: `{{ page | jsonld: site }}`

  It reads these front-matter fields when present: `title`, `description` (falls back to the page's auto-`excerpt`, then `site.description`), `url` (made absolute with `site.url`), `date` → `datePublished`, `updated` → `dateModified`, `author` (string or `{ name }`, falls back to `site.author`), `image`, `lang` → `inLanguage`, and `wordcount`. `publisher` comes from `site.title`; set `site.logo` to add a `publisher.logo` ImageObject (made absolute) — Google Article rich results require it. Front-matter values are escaped so they can't break out of the `<script>` tag.

  On the homepage (a page with no `url`) it also emits a site-level `WebSite` block with `name` + `url`, which declares the site name for search results. On nested pages (a `url` with at least one folder) it auto-appends a `BreadcrumbList` block derived from URL depth — a Google breadcrumb rich result, no extra markup (needs `site.url` for the absolute item URLs). See the `breadcrumb` filter below for a visible trail from the same data.

  For full control, set a `jsonld` object in front matter — its keys are merged over (and override) the generated defaults, including `@type`:

  ```yaml
  ---
  title: How to brew coffee
  date: 2026-01-01
  jsonld:
    "@type": HowTo
    totalTime: PT5M
  ---
  ```

  poops auto-picks `BlogPosting` (page has a `date`) or `WebPage`. Override `@type` with the `jsonld` object for any schema.org type — common ones search/generative engines act on: `Article`, `NewsArticle`, `HowTo`, `FAQPage`, `QAPage`, `Product`, `Recipe`, `Event`, `Course`, `VideoObject`, `SoftwareApplication`, `Organization`, `Person`, `BreadcrumbList`, `WebSite`. Full list at [schema.org/docs/full](https://schema.org/docs/full.html); validate with the [Rich Results Test](https://search.google.com/test/rich-results). A per-`@type` table with the notable fields is in the [Templating docs](example/src/markup/docs/quick-start/templating-html.md).

- `breadcrumb` — generates a visible breadcrumb `<nav class="breadcrumb"><ol>…</ol></nav>` trail for the page body (blog posts, nested pages), from the same URL-depth data the `jsonld` `BreadcrumbList` uses: the site root, each ancestor folder (humanized, e.g. `docs/static-site` → _Static Site_), then the current page as `aria-current` text. Pass `relativePathPrefix` so links resolve against the current output location (localhost in dev, your deployed subpath in prod) — not the absolute domain.
  - Nunjucks: `{{ page | breadcrumb(site, relativePathPrefix) }}`
  - Liquid: `{{ page | breadcrumb: site, relativePathPrefix }}`

  The home crumb is optional: set `breadcrumb: { home: false }` (or `{ homeLabel: "Start" }` to rename it) under `site` or in a page's front matter — front matter wins. With the home crumb off, top-level pages fall to a single crumb and render nothing, while nested pages still show their folder trail. `breadcrumb: false` on a page or on `site` disables both the visible trail and the auto `BreadcrumbList` JSON-LD. Returns nothing on the homepage or any single-crumb page.

- `groupby` — groups an array of objects by a field value. Returns an array of `{ key, items }` objects. Supports an optional second argument for date part extraction (`year`, `month`, `day`). Groups preserve insertion order, so if items are sorted by date descending, groups will be too. Array-valued fields split per element — an item with `tags: [js, css]` appears in **both** the `js` and `css` groups (the mechanism behind [taxonomies](#taxonomies-tags--categories)).
  - Nunjucks: `{{ changelog.items | groupby("author") }}` or `{{ changelog.items | groupby("date", "year") }}`
  - Liquid: `{{ changelog.items | groupby: "author" }}` or `{{ changelog.items | groupby: "date", "year" }}`

  Example — group posts by year:

  ```nunjucks
  {% set byYear = changelog.items | groupby("date", "year") %}
  {% for group in byYear %}
    <h2>{{ group.key }}</h2>
    {% for post in group.items %}
      <p>{{ post.title }}</p>
    {% endfor %}
  {% endfor %}
  ```

- `srcset` — returns just the srcset attribute value:

```html
<img
  src="static/photo-640w.jpg"
  srcset="{{ 'static/photo.jpg' | srcset }}"
  sizes="100vw"
  alt="Hero"
/>
```

Returns: `static/photo-320w.webp 320w, static/photo-640w.webp 640w, static/photo-960w.webp 960w`

Pass a named crop/resize group as the second argument to get that group's srcset instead of the default widths: `{{ 'static/photo.jpg' | srcset: 'thumb' }}` → `static/photo-thumb-480w.webp 480w, static/photo-thumb.webp 960w`.

- `exif` — returns the EXIF metadata object for an image from the [poops-images](https://github.com/stamat/poops-images) compile cache (`.poops-images-cache.json` in the output directory), or `null` if there is no cache or no EXIF data. The object includes camera (`make`, `model`, `lensModel`), exposure (`fNumber`, `exposure.formatted`, `iso`, `focalLength35mm`), `dateTime`, and `gps` (`latitude.formatted`, `longitude.formatted`, `altitude`, and a ready-made `googleMapsUrl`).

  Example — a photo with date and location caption:

  ```nunjucks
  {% set meta = 'static/photo.jpeg' | exif %}
  <figure>
    {% image 'static/photo.jpeg', alt='Sendai at dusk' %}
    {% if meta %}
      <figcaption>
        {{ meta.dateTime | date("MMMM D, YYYY") }}
        {% if meta.gps %}
          — <a href="{{ meta.gps.googleMapsUrl }}">{{ meta.gps.latitude.formatted }}, {{ meta.gps.longitude.formatted }}</a>
        {% endif %}
        {% if meta.model %}· {{ meta.model }}{% endif %}
      </figcaption>
    {% endif %}
  </figure>
  ```

- `images` — lists all images under a site-relative directory from the [poops-images](https://github.com/stamat/poops-images) compile cache. Returns an array of `{ path, width, height, date, exif, outputs }` objects, or an empty array if there is no cache:
  - `path` — site-relative source path, feeds straight into the `{% image %}` tag
  - `date` — `exif.dateTime` when the photo has EXIF, file modification time otherwise — so sorting and grouping work for every image
  - `outputs` — every generated file for the image (site-relative), useful for picking LQIP or preprocessed variants
  - Pass a subdirectory (`'static/images/2025'`) to scope the list

  **The path is relative to your markup `out` dir, not to `images.in`.** It mirrors where the generated images land — i.e. `images.out` made relative to markup `out`. So if `images.out` is `_site/static/images` and markup `out` is `_site`, the images live at `static/images` on the site and you call `'static/images' | images` (**not** `'images'`, which would look in `_site/images` and return `[]`). This is the same path you already pass to the `{% image %}` tag.

  Combined with `groupby`, engine-native sorting and the `{% image %}` tag, a photo gallery is a pure template concern. This is the Instagram-style square grid — `size='thumb'` pulls the named crop group and its auto-generated srcset (define a `thumb` crop in `images.sizes`):

  Nunjucks:

  ```nunjucks
  {% for group in 'static/images' | images | sort(reverse=true, attribute='date') | groupby("date", "year") %}
    <h2>{{ group.key }}</h2>
    <div class="grid">
      {% for img in group.items %}
        <figure>
          {% image img.path, size='thumb', alt='', sizes='(max-width: 640px) 50vw, 240px' %}
          {% if img.exif and img.exif.gps %}
            <figcaption>
              <a href="{{ img.exif.gps.googleMapsUrl }}">📍</a> {{ img.date | date("MMM D, YYYY") }}
            </figcaption>
          {% endif %}
        </figure>
      {% endfor %}
    </div>
  {% endfor %}
  ```

  Liquid:

  ```liquid
  {% assign imgs = 'static/images' | images | sort: 'date' | reverse %}
  {% assign groups = imgs | groupby: "date", "year" %}
  {% for group in groups %}
    <h2>{{ group.key }}</h2>
    <div class="grid">
      {% for img in group.items %}
        <figure>{% image img.path, size: 'thumb', alt: '' %}</figure>
      {% endfor %}
    </div>
  {% endfor %}
  ```

#### Search Index, Sitemap, llms.txt, robots.txt & Navigation

Poops can automatically generate a JSON search index, an XML sitemap, an `llms.txt`, a `robots.txt` and a navigation tree from your compiled pages. All are generated in a single pass during the markup compilation phase.

To enable, add `searchIndex`, `sitemap`, `llms`, `robots` and/or `nav` to your markup config:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "searchIndex": "search-index.json",
      "sitemap": "sitemap.xml",
      "llms": "llms.txt",
      "robots": "robots.txt"
    }
  }
}
```

The string shorthand sets the output filename with default options. For more control, use the object form:

```json
{
  "searchIndex": {
    "output": "search-index.json",
    "minWordLength": 3,
    "maxKeywords": 20,
    "globalFrequencyCeiling": 0.8,
    "stopWords": "path/to/custom-stop-words.json"
  },
  "sitemap": {
    "output": "sitemap.xml"
  },
  "llms": {
    "output": "llms.txt",
    "title": "My Site",
    "description": "One-line summary of the site.",
    "intro": "src/llms-intro.md",
    "full": true
  }
}
```

**Search Index options:**

- `output` — output filename, written to the markup output directory
- `minWordLength` — minimum word length to consider as a keyword (default: `3`)
- `maxKeywords` — maximum keywords per page (default: `20`)
- `globalFrequencyCeiling` — drop words appearing in more than this fraction of all pages (default: `0.8`, meaning words found in 80%+ of pages are dropped as non-discriminating)
- `stopWords` — customise stop word filtering:
  - omit or `undefined` — uses the bundled English stop words
  - `false` — disables stop word filtering entirely
  - `["word1", "word2"]` — inline array of stop words
  - `"path/to/file.json"` — path to a JSON array file (relative to project root)

**Search Index output format:**

All front matter fields are passed through to the index automatically. Internal fields (`content`, `isIndex`, `layout`, `published`) are stripped. If a page defines `keywords` in its front matter, those are used as-is instead of auto-extracted ones.

```json
[
  {
    "title": "My Post",
    "date": "2024-01-15",
    "description": "A great post about things.",
    "collection": "blog",
    "tags": ["javascript", "bundler"],
    "url": "blog/my-post.html",
    "keywords": ["javascript", "bundler", "webpack", "esbuild"]
  }
]
```

**Sitemap** generates a standard `sitemap.xml` with `<loc>` and `<lastmod>` (from front matter `date`). If `site.url` is set in your markup config, it is prepended to all URLs. Collection index/pagination and taxonomy term pages are included in the sitemap but excluded from the search index.

**llms.txt** generates an [`llms.txt`](https://llmstxt.org) — a Markdown index of your pages that LLMs and generative engines (GEO) read to understand your site. It has an `# H1` title, a `> ` blockquote summary, then `- [title](url): description` links grouped by URL path: the first folder is a `## section`, a second folder nests as a `### subsection` under it, and root-level pages fall under a lead "Pages" section. So `docs/config-reference.html` lands directly under `## Docs` while `docs/quick-start/x.html` lands under `### Quick Start` inside it. Collection items (which live under `collection/…`) group the same way and are ordered newest-first by their `date`; other sections keep file order. Set `intro` to a Markdown file path (relative to the project root) to insert free-form context between the blockquote and the link sections — a file authored for LLMs, e.g. `llms-intro.md`. Avoid `##` headings in it; they read as sections. (A raw README is a poor fit — badges, install noise and its own headings collide.) `title` and `description` default to your `site.title`/`site.description`; override them (and the lead section name via `sectionTitle`) with the object form. `site.url` makes the links absolute. Collection index/pagination pages are skipped, like the search index.

Set `full` to also write a companion full-content file — every page's Markdown body concatenated into one file an LLM can ingest whole (the index is the link map; this is the corpus). `true` names it after `output` with a `-full` suffix (`llms.txt` → `llms-full.txt`, `ai.txt` → `ai-full.txt`); pass a string to set the path yourself. The file opens with a `# Full Documentation Archive for {title}` header, a one-line intro naming the site and a `> ` blockquote of the `description` so a whole-file ingest starts with context, then each page becomes an `# title` (its own leading H1 if it has one) + `URL:` line + body, joined by `---`. Set `fullIntro` to a Markdown file path (from the project root) to insert your own preamble after that header — the `full` counterpart to `intro` (inserted verbatim; a missing file warns and is skipped). Only `.md`/`.markdown` sources qualify (a `.njk`/`.liquid` source is template code, not prose); `noindex` and collection-index pages are dropped. Content is the Markdown **source**, so unrendered `{% raw %}{% … %}{% endraw %}` tags or shortcodes in a body pass through verbatim.

**robots.txt** generates a `robots.txt`. The string shorthand writes an allow-all file (`User-agent: *`, empty `Disallow:`) with a `Sitemap:` line pointing at your generated sitemap — absolute when `site.url` is set. The object form takes `output`, `userAgent`, `allow`/`disallow` (a path or array of paths), and `sitemap` (an explicit URL, or `false` to omit the line):

```json
{
  "robots": {
    "output": "robots.txt",
    "disallow": ["/admin", "/drafts"],
    "sitemap": false
  }
}
```

Pages with `published: false` in their front matter are excluded from all outputs.

A page's front matter `robots: noindex` (or `none`) drops it from the **sitemap and llms.txt** — for drafts, thin or utility pages (a 404, say) you don't want crawled or fed to LLMs. It stays in the search index (that's your own on-site search). Emit the matching crawler directive in your layout `<head>` so the page itself carries it:

```html
{% if page.robots %}<meta name="robots" content="{{ page.robots }}" />{% endif
%}
```

**Navigation tree** builds your page hierarchy as sidebar-ready data, exposed two ways: as the `nav` template global (loaded automatically, always reflecting the current build) and as a nested JSON file for client-side rendering. Subpages nest automatically from URL structure: `guide/index.md` becomes a parent node and `guide/getting-started.md`, `guide/advanced/config.md` become its (and its subsections') children. Add `nav` to your markup config:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "nav": "nav.json"
    }
  }
}
```

The string shorthand sets the output filename. For docs sites, use the object form:

```json
{
  "nav": {
    "output": "nav.json",
    "root": "docs",
    "collections": "index",
    "home": false
  }
}
```

**Navigation options:**

- `output` — output filename, written to the markup output directory
- `collections` — how to treat collection pages (default `true`):
  - `true` — include every collection page, nested under its collection
  - `false` — exclude all collection pages (drops a blog's posts from the sidebar)
  - `["docs", ...]` — allowlist; only these collections' pages are included (non-collection pages are always kept)
  - `"index"` — include only each collection's landing page as a single leaf, not its posts
- `home` — `false` drops the site's root index page (url `""`) from the tree (default `true`)
- `root` — scope the tree to a subdirectory (e.g. `"docs"`); its children are emitted at the top level and the section's own index page is pinned first as the overview link. URLs are kept full (`docs/getting-started`), so the homepage is naturally excluded

**Front matter fields** that shape the tree:

- `order` — a number that sorts a page within its sibling level (optional). Pages without `order` fall to the bottom, sorted alphabetically by title — so a hand-authored docs sequence (`1`, `2`, `3`) wins over alphabetical. This applies to the homepage too: give it `order: 0` in its front matter to pin it to the top, otherwise it sorts last like any page without `order`.
- `nav: false` — hide a page from the sidebar (it stays in the search index and sitemap).
- `navTitle` — a sidebar label that overrides `title`.

**Navigation output format** — each node has a `title`, a `url` (omitted on synthesized section nodes that have no index page of their own), an `order` when set, and `children` when it has subpages:

```json
[
  {
    "title": "Guide",
    "url": "guide",
    "order": 1,
    "children": [
      {
        "title": "Getting Started",
        "url": "guide/getting-started",
        "order": 1
      },
      {
        "title": "Advanced",
        "url": "guide/advanced",
        "children": [{ "title": "Config", "url": "guide/advanced/config" }]
      }
    ]
  }
]
```

Pages with `published: false` or `nav: false` are excluded. If nothing survives filtering, an empty array `[]` is written so consumers never have to special-case a missing file.

**Rendering the sidebar.** The tree is arbitrarily deep, so render it with a recursive template. The `nav` global is built from front matter in a pre-pass before templating, so it always reflects the current build — no need to load the generated `nav.json` back in via `data` (which would be one build behind). The written `nav.json` is for client-side rendering (`fetch('/nav.json')`). Prefix each `url` with `relativePathPrefix` so links resolve from any page depth.

Nunjucks — a self-recursing macro:

```njk
{% macro navtree(items) %}
<ul>
  {% for item in items %}
  <li>
    {% if item.url != null %}<a href="{{ relativePathPrefix }}{{ item.url }}">{{ item.title }}</a>
    {% else %}<span>{{ item.title }}</span>{% endif %}
    {% if item.children %}{{ navtree(item.children) }}{% endif %}
  </li>
  {% endfor %}
</ul>
{% endmacro %}

{{ navtree(nav) }}
```

Note the `!= null` check: the homepage node's `url` is an empty string (a valid link — `relativePathPrefix` resolves it), while synthesized section nodes have no `url` at all. A plain `{% if item.url %}` would wrongly demote the homepage to a `<span>`. Node titles already have `navTitle` applied, so `{{ item.title }}` is all you need.

Liquid — a partial that recurses via `render` (save as `_partials/navtree.liquid`). Liquid treats empty strings as truthy, so the plain `if` is safe here:

```liquid
<ul>
  {% for item in items %}
  <li>
    {% if item.url %}<a href="{{ relativePathPrefix }}{{ item.url }}">{{ item.title }}</a>
    {% else %}<span>{{ item.title }}</span>{% endif %}
    {% if item.children %}{% render 'navtree', items: item.children, relativePathPrefix: relativePathPrefix %}{% endif %}
  </li>
  {% endfor %}
</ul>
```

```liquid
{% render 'navtree', items: nav, relativePathPrefix: relativePathPrefix %}
```

#### RSS / Atom feeds

Generate a subscription feed for a [collection](#collections) — no hand-authored feed template. Each feed lists the collection's posts newest-first (by `date`), with the channel metadata taken from your `site` data.

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "feed": { "collection": "blog", "output": "blog/feed.rss" }
    }
  }
}
```

**Feed options:**

- `collection` — the collection to build the feed from. Omit it to emit a feed for **every** collection.
- `output` — the file to write. A bare filename (`feed.xml`, the default) is placed inside the collection's own folder (`blog/feed.xml`); a value with a slash is used as-is under the output directory.
- `type` — `"rss"` (default) or `"atom"`.
- `limit` — max items, newest first (default `20`).
- `title` — channel title (default `"<Collection> | <site.title>"`).
- `description` — channel description (default `site.description`).
- `author`, `lang` — default to `site.author` / `site.lang`.

Shorthand forms: `"feed": true` (or a filename string) emits an RSS feed for every collection; an array of the objects above generates several feeds at once (e.g. an RSS and an Atom for the same collection). Item `<description>` uses each post's `description`, falling back to its auto-`excerpt`; links, `guid`s and `<atom:link rel="self">` are made absolute with `site.url`. `robots: noindex` posts are excluded, matching the sitemap.

Point browsers and readers at it from your layout `<head>`:

```html
<link
  rel="alternate"
  type="application/rss+xml"
  href="{{ site.url }}/blog/feed.rss"
/>
```

### Images (optional)

Process and optimize images — compression, responsive size variants, format conversion (WebP/AVIF), crops and EXIF extraction — by running [poops-images](https://github.com/stamat/poops-images) as part of the build. This is what feeds the `{% image %}` tag, the `exif`/`images` filters and the `.poops-images-cache.json` compile cache described in [Custom Tags](#custom-tags) and [Custom Filters](#custom-filters).

poops-images (and its `sharp` dependency) is **not** bundled with Poops. Install it in your project only if you use the `images` config:

```bash
npm i poops-images
```

If the `images` key is present but poops-images is not installed, Poops logs a warning and skips image processing — the rest of the build still runs.

The `images` value is a poops-images config object (see the [poops-images options reference](https://github.com/stamat/poops-images#configuration)). The most common keys:

- `in` — source images directory
- `out` — output directory (keep it distinct from `in`, and outside your watched source, so generated variants don't retrigger the build)
- `sizes` — responsive widths to generate
- `format` — target formats (e.g. `["webp"]`, or `"smart"` to keep whichever of JPEG/WebP is smaller)
- `verbose` - defaults to `false`, so you get a single `[image]` summary line (count + time) instead of one log per file. Set `"verbose": true` to restore the per-file logs.

```json
{
  "images": {
    "in": "src/images",
    "out": "dist/images",
    "sizes": [{ "width": 640 }, { "width": 1280 }],
    "format": "smart"
  }
}
```

Images are processed **before** markup, so `{% image %}` and the `images` filter always read a fresh cache. In watch mode, changing a source image reprocesses it and recompiles markup; deleting one removes its generated variants and updates the galleries that referenced it. Custom handlers and composite overlays resolve relative to your `poops.json`.

### Copy

Configuration entry to copy files or directories - copy your static files like images and fonts, for instance, from `src` to `dist` directory. This feature was added to enable moving static files if you deploy GitHub pages via a GitHub action. If you don't want to use this feature, simply exclude the `copy` property from your config file.

Here is a sample copy configuration which will copy the `static` directory and it's contents to the `dist` directory:

```JSON
{
  "copy": {
    "in": "src/static",
    "out": "dist"
  }
}
```

You can specify a list of input paths and pass them to an output directory, for instance:

```JSON
{
  "copy": {
    "in": ["src/static/ogimage.jpg", "src/static/favicon.ico", "src/fonts"],
    "out": "dist"
  }
}
```

**💡 NOTE:** Copy property can also accept the list of objects containing `in` and `out` properties. For instance:

```JSON
{
  "copy": [
    {
      "in": ["src/static/ogimage.jpg", "src/static/favicon.ico", "src/fonts"],
      "out": "dist"
    },
    {
      "in": "images",
      "out": "dist/static"
    }
  ]
}
```

**💡 NOTE:** Copy can also accept **GLOB** and **EXTGLOB** patterns as input paths, except POSIX character classes (e.g. `[[:alpha:]]`):

```JSON
{
  "copy": {
    "in": [
      "images/**/awesome.{jpeg,jpg,png}",
      "notes/info[0-9].txt",
      "notes/doc?.txt",
      "notes/memo*.txt",
      "notes/log[!123a].txt",
      "assets/!(vendor)/*.js",
      "fonts/@(woff|woff2)/*.+(woff|woff2)",
      "docs/?(intro|overview).md"
    ],
    "out": "dist"
  }
}
```

### Banner (optional)

Here you can specify a banner that will be added to the top of the output files. It is templatable via mustache. The following variables are available from your project's `package.json`:

- `name`
- `version`
- `homepage`
- `license`
- `author`
- `description`

Here is a sample banner template.

```
/* {{ name }} v{{ version }} | {{ homepage }} | {{ license }} License */
```

You can always pass just a string, you don't have to template it.

If you don't want to add a banner, just remove the `banner` property from the config.

### Local Server (optional)

Sets up a local server for your project.

Server options:

- `port` - the port on which the server will run
- `base` - the base path of the server, where your HTML files are located

If you don't want to run a local server, just remove the `serve` property from the config.

### Live Reload (optional)

Sets up a livereload server for your project.

Live reload options:

- `port` - the port on which the livereload server will run
- `exclude` - an array of files and directories to exclude from livereload
- `extraExts` - an array of extra file extensions (without the dot) that trigger a browser refresh, added to the defaults
- `exts` - an array of file extensions that replaces the default list entirely

By default a refresh is triggered by changes to: `html`, `css`, `js`, `png`, `gif`, `jpg`, `php`, `php5`, `py`, `rb`, `erb`, `coffee`. If you work with other file types, for example Slim or Nunjucks templates, add them:

```json
{
  "livereload": {
    "extraExts": ["slim", "njk"]
  }
}
```

`livereload` can only be `true`, which means that it will run on the default port (`35729`) or you can specify a port:

```json
{
  "livereload": {
    "port": whateverPortYouWant
  }
}
```

You can also exclude files and directories from livereload:

```json
{
  "livereload": {
    "exclude": ["some_directory/**/*", "some_other_directory/**/*"]
  }
}
```

In order for Livereload to work, you need to add the following script snippet to your HTML files in your development environment:

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

Be mindful of the port, if you have specified a custom port, you need to change the port in the snippet as well.

You can also use a browser extension for livereload, for instance here is one for [Chrome](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei?hl=en). You can find also extensions for Firefox and Opera, but NOT for Safari.

If you don't want to run livereload, just remove the `livereload` property from the config, or set it to false.

### Watch (optional)

Sets up a watcher for your project which will rebuild your files on change.

`watch` property accepts an array of paths to watch for changes. If you want to watch for changes in the `src` directory, just add it to the `watch` array:

```json
{
  "watch": ["src"]
}
```

If you don't want to watch for file changes, just remove the `watch` property from the config.

### Include Paths (optional)

This property is used to specify paths that you want to resolve your imports from. Like `node_modules`. You don't need to specify the `includePaths`, `node_modules` are included by default. But if you do specify `includePaths`, you need to include `node_modules` as well, since this change will override the default behavior.

Same as `watch` property, `includePaths` accepts an array of paths to include. If you want to include `lib` directory for instance, just add it to the `includePaths` array:

```json
{
  "includePaths": ["node_modules", "lib"]
}
```

## Why?

Why doesn't anyone maintain GULP anymore? Why does Parcel hate config files? Why are Rollup and Webpack so complex to setup for simple tasks? Vite???? What's going on?

I'm tired... Tired of bullshit... I just want to bundle my scss/sass and/or my js/ts to css and iife/esm js, by providing input and output paths for both/one. And to be able to have minimal easily maintainable dependencies. I don't need plugins, I'll add the features manually for the practice I use. That's it. The f\*\*king end.

To better illustrate it, here is a sample diff of Poops replacing Rollup:

![Screenshot 2023-07-03 at 16 34 32](https://github.com/stamat/poops/assets/1429864/6a8598e7-d188-4d9f-ae3c-5bfa3bbf78e9)

This is a bundler written by me for myself and those like me. Hopefully it's helpful to you too.

Love :heart: and peace :v:.
