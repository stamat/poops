---
layout: docs
title: Quick Start
navTitle: Quick Start
description: The initial idea behind Poops and the structure of the poops.json config file.
order: 1
keywords: ["quick start", "config", "poops.json", "cli"]
---

# Quick Start

Poops is driven by a single config file: **`poops.json`** (or `💩.json`) in your project root.
Every feature is a top-level key. You opt into the pipelines you need and delete the rest.

## Run it

If Poops is installed globally, from your project root run:

```bash
poops        # or 💩
```

Pass a custom config when you juggle multiple environments:

```bash
poops staging.json     # or 💩 staging.json
```

Installed locally, use `npx` or a `package.json` script:

```json
{
  "scripts": {
    "build": "npx poops"
  }
}
```

## CLI options

| Flag | Short | Description |
| --- | --- | --- |
| `--build` | `-b` | Build once and exit (no watch/serve) |
| `--config <path>` | `-c` | Use a specific config file |
| `--port <number>` | `-p` | Server port, overrides config |
| `--livereload-port <number>` | `-l` | LiveReload port, overrides config |
| `--base-url <path>` | `-u` | Base URL prefix for markup, overrides config |

`--base-url` is the one you'll reach for in CI, where the deploy path differs per environment:

```bash
poops --build --base-url /blog
```

## The shape of the config

Here is a config that exercises most pipelines at once. You will rarely need all of it —
treat it as a menu.

```json
{
  "scripts": [
    { "in": "src/js/main.ts", "out": "dist/js/scripts.js",
      "options": { "minify": true, "format": "iife", "target": "es2019" } }
  ],
  "styles": [
    { "in": "src/scss/index.scss", "out": "dist/css/styles.css",
      "options": { "sourcemap": true, "minify": true } }
  ],
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "site": { "title": "My Site", "description": "A site built with Poops." },
    "includePaths": ["_layouts", "_partials"]
  },
  "copy": [{ "in": "src/static", "out": "dist" }],
  "serve": { "port": 4040, "base": "/dist" },
  "livereload": true,
  "watch": ["src"]
}
```

Every key is independent:

- **`scripts`** — bundle JS/TS/JSX/TSX. See [Transpiling JavaScript](transpiling-js).
- **`styles`** — compile SCSS/Sass. See [Transpiling CSS](transpiling-css).
- **`postcss`** — a separate CSS pipeline for Tailwind & PostCSS plugins. See [PostCSS & Tailwind](postcss-tailwind).
- **`markup`** — the static site generator. See [Templating HTML](templating-html).
- **`reactor`** — build-time React rendering. See [React](react).
- **`copy` / `serve` / `livereload` / `watch`** — static files and the dev loop.

Bolting Poops onto WordPress, Laravel, Rails or Django instead of building a full static site? See
[Use with frameworks](frameworks).

> [!INFO]
> Poops reads your project's `package.json` automatically and exposes it to templates as the
> `package` global. So `{% raw %}{{ package.version }}{% endraw %}` just works — handy for a
> library landing page.

> [!WARNING]
> Removing a pipeline key is how you disable it. There is no `"enabled": false` flag — if a key
> isn't in the config, that pipeline never runs.

## The idea

The whole design is: **inputs and outputs, nothing hidden.** You should be able to read a
`poops.json` top to bottom and know exactly what files come out and where. No implicit magic
directories, no convention you have to memorize, no plugin resolution order. That readability is
worth more than cleverness — it is the reason Poops exists.

Next: pick a pipeline. Most people start with [Transpiling JavaScript](transpiling-js) or jump
straight to [Build a Static Site](../static-site/).
