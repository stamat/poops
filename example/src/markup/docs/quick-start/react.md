---
layout: docs
title: React
navTitle: React
description: Three ways to use React with Poops — a client bundle via scripts, build-time pre-rendering via Reactor, or both with hydration.
order: 7
keywords: ["react", "jsx", "tsx", "reactor", "hydration", "ssg", "pre-render"]
---

# React

Poops speaks React three ways. Which you pick depends on whether you want the HTML rendered in the
browser, at build time, or both.

## 1. Client-side React (the `scripts` pipeline)

The simplest option: point a `scripts` entry at your `.jsx`/`.tsx` entry and mount with
`createRoot` on the client.

```json
{
  "scripts": [
    {
      "in": "src/js/app.jsx",
      "out": "dist/js/app.js",
      "options": { "minify": true, "format": "iife", "jsx": "automatic" }
    }
  ]
}
```

`"jsx": "automatic"` uses React 17+'s JSX runtime, so you don't `import React` in every file.
Omit it (or set `"transform"`) for the classic `React.createElement` transform.

This is a normal client-rendered SPA — nothing is rendered until the JS runs. See
[Build a React App](../react-app/) for the full setup.

## 2. Build-time pre-rendering (the `reactor` key)

`reactor` renders a React component to HTML **at build time** with `renderToString`, and exposes
that HTML to your templates. Optionally it also ships a client bundle that hydrates it — so the
page is real HTML immediately and becomes interactive after hydration.

```json
{
  "reactor": [
    {
      "component": "src/js/App.jsx",
      "inject": "app_html",
      "in": "src/js/app-hydrate.jsx",
      "out": "dist/js/app-hydrate.js",
      "options": { "minify": true, "target": "es2019" }
    }
  ]
}
```

- **`component`** — file that default-exports the component to render.
- **`inject`** — template global name holding the rendered HTML.
- **`in` / `out`** *(optional)* — client hydration entry and its bundle.
- **`options`** *(optional)* — esbuild options for the client bundle.

In your template, drop the rendered HTML in and load the hydration bundle:

```html
{% raw %}<div id="root">{{ app_html | safe }}</div>
<script src="js/app-hydrate.min.js"></script>{% endraw %}
```

Server-only (no hydration)? Omit `in`/`out`:

```json
{
  "reactor": [
    { "component": "src/js/App.jsx", "inject": "app_html" }
  ]
}
```

> [!INFO]
> `reactor` is its own pipeline with its own watcher and build step. Changes to the component
> re-render and re-bundle; markup recompiles only when the rendered output actually changes.
> Plain JS/TS edits only trigger the `scripts` pipeline — the two are independent.

> [!NOTE]
> Poops does **not** depend on `react`/`react-dom`. They are resolved from *your* project's
> `node_modules`. Install them yourself: `npm i react react-dom`.

> [!TIP]
> For backwards compatibility the key `"ssg"` is accepted as an alias for `"reactor"`.

## Which should I use?

| Goal | Use |
| --- | --- |
| Interactive SPA, SEO not critical | `scripts` + `createRoot` |
| Static HTML pages that don't need JS | `reactor` (no `in`/`out`) |
| Static HTML that hydrates into an app | `reactor` with `in`/`out` |

Worked examples: [React components](../static-site/react-components),
[A complete React static site](../static-site/react-static-site), and
[Build a React App](../react-app/).
