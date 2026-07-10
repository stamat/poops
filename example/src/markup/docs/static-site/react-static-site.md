---
layout: docs
title: A complete React static site
navTitle: A complete React SSG
description: Turn the React SPA into a pre-rendered, hydrated static site — three changes to the setup from Build a React App.
order: 6
keywords: ["react", "ssg", "static site", "hydration", "reactor", "renderToString"]
---

# A complete React static site

A full site whose pages are React-rendered at build time and hydrated in the browser: fast first
paint (real HTML), full interactivity after hydration, and no runtime SSR server — it's static
files.

This page builds directly on [Build a React App](../react-app/). Same project, same `App.jsx`,
same styles and markup config. **Three changes** turn the client-only SPA into a pre-rendered,
hydrated static site:

## 1. Swap `scripts` for `reactor`

Replace the SPA's `scripts` entry with a `reactor` entry. Everything else in the config —
`styles`, `markup`, `serve`, `watch` — stays exactly as it was:

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

`component` is rendered to HTML at build time; the result is exposed to templates as `app_html`.
`in`/`out` bundle the client entry that hydrates it. Full option reference in
[React › Build-time pre-rendering](../quick-start/react#2-build-time-pre-rendering-the-reactor-key).

## 2. Hydrate instead of mount

The SPA's `main.tsx` called `createRoot`. Here the client entry *hydrates* the HTML that is
already on the page:

```jsx
// src/js/app-hydrate.jsx
import { hydrateRoot } from 'react-dom/client'
import App from './App.jsx'

hydrateRoot(document.getElementById('root'), <App />)
```

## 3. Inject the rendered HTML

The SPA shipped an empty `<div id="root">`. Now the template drops the build-time HTML into it,
then loads the hydration bundle:

```html
{% raw %}{% extends "default.html" %}
{% block content %}
  <div id="root">{{ app_html | safe }}</div>
  <script src="{{ relativePathPrefix }}js/app-hydrate.min.js"></script>
{% endblock %}{% endraw %}
```

## How the build flows

1. Poops bundles `App.jsx` with `react-dom/server`, calls `renderToString`, stores the HTML as
   `app_html`.
2. Markup renders `index.html`, injecting `app_html` into `#root`.
3. `app-hydrate.jsx` is bundled to `dist/js/app-hydrate.min.js`.
4. In the browser, React hydrates the pre-rendered HTML — the page is interactive.

> [!TIP]
> This gives you SSG with hydration and no separate server. Deploy the `dist/` folder to any
> static host (GitHub Pages, Netlify, S3).

> [!WARNING]
> The server-rendered markup and the client's first render must match, or React logs a hydration
> mismatch. Keep `App.jsx` deterministic at build time — no `Date.now()`, `Math.random()` or
> browser-only APIs during the initial render.

Full runnable examples live in the Poops repository's `example/` directory (`react.html` and
`react-client.html`).
