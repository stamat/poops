---
layout: docs
title: A complete React static site
navTitle: A complete React SSG
description: Combine Reactor, styles and markup into a full pre-rendered, hydrated React static site.
order: 6
keywords: ["react", "ssg", "static site", "hydration", "reactor", "renderToString"]
---

# A complete React static site

Putting it together: a full site whose pages are React-rendered at build time and hydrated in the
browser. Fast first paint (real HTML), full interactivity after hydration, and no runtime SSR
server — it's static files.

## Project layout

```text
react-site/
├─ poops.json
├─ package.json          # react + react-dom installed here
└─ src/
   ├─ scss/index.scss
   ├─ js/
   │  ├─ App.jsx          # the app, default export
   │  └─ app-hydrate.jsx  # client hydration entry
   └─ markup/
      ├─ _layouts/default.html
      └─ index.html       # injects the rendered app
```

## The app and its hydration entry

```jsx
// src/js/App.jsx
import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  return (
    <main>
      <h1>Poops + React</h1>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
    </main>
  )
}
```

```jsx
// src/js/app-hydrate.jsx
import { hydrateRoot } from 'react-dom/client'
import App from './App.jsx'

hydrateRoot(document.getElementById('root'), <App />)
```

## The config

```json
{
  "styles": [
    { "in": "src/scss/index.scss", "out": "dist/css/styles.css", "options": { "minify": true } }
  ],
  "reactor": [
    {
      "component": "src/js/App.jsx",
      "inject": "app_html",
      "in": "src/js/app-hydrate.jsx",
      "out": "dist/js/app-hydrate.js",
      "options": { "minify": true, "target": "es2019" }
    }
  ],
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "site": { "title": "Poops + React" },
    "includePaths": ["_layouts", "_partials"]
  },
  "serve": { "port": 4040, "base": "/dist" },
  "livereload": true,
  "watch": ["src"]
}
```

## The page

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

> [!INFO]
> Want plain client-side React with no pre-rendering at all? Skip `reactor` and use the `scripts`
> pipeline with `createRoot` — see [Build a React App](../react-app/).

Full runnable examples live in the Poops repository's `example/` directory (`react.html` and
`react-client.html`).
