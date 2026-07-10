---
layout: docs
title: React components in a static site
navTitle: React components
description: Pre-render React components to HTML at build time with Reactor and inject them into your templates, with optional hydration.
order: 5
keywords: ["react", "reactor", "components", "pre-render", "hydration", "ssg"]
---

# React components in a static site

Sometimes you want a React component *inside* an otherwise-static page — an interactive counter, a
clock, a filterable table — without turning the whole site into an SPA. That's what `reactor` is
for: render the component to HTML at build time, inject it into a template, and optionally hydrate
it on the client.

## The component

A plain component with a default export:

```jsx
// src/js/Counter.jsx
import { useState } from 'react'

export default function Counter() {
  const [n, setN] = useState(0)
  return (
    <button onClick={() => setN(n + 1)}>
      Clicked {n} times
    </button>
  )
}
```

## The hydration entry

A tiny client entry that hydrates the pre-rendered markup:

```jsx
// src/js/counter-hydrate.jsx
import { hydrateRoot } from 'react-dom/client'
import Counter from './Counter.jsx'

hydrateRoot(document.getElementById('counter'), <Counter />)
```

## The config

```json
{
  "reactor": [
    {
      "component": "src/js/Counter.jsx",
      "inject": "counter_html",
      "in": "src/js/counter-hydrate.jsx",
      "out": "dist/js/counter.js",
      "options": { "minify": true, "target": "es2019" }
    }
  ]
}
```

Poops renders `Counter` with `renderToString` and stores the HTML under the `inject` name. The
client entry is bundled to `out`.

## The template

Drop the rendered HTML in, then load the hydration bundle:

```html
{% raw %}<h1>Dashboard</h1>
<div id="counter">{{ counter_html | safe }}</div>
<script src="{{ relativePathPrefix }}js/counter.min.js"></script>{% endraw %}
```

The page ships as real HTML — the button is visible before any JS runs — and becomes interactive
once React hydrates it.

> [!NOTE]
> React comes from your project's `node_modules` (`npm i react react-dom`), and `reactor` is its
> own pipeline, independent from `scripts` — details in [React](../quick-start/react).

## Server-only components

Need the HTML but no interactivity (an icon, a formatted block)? Omit `in`/`out` and skip the
hydration bundle entirely:

```json
{
  "reactor": [
    { "component": "src/js/Icon.jsx", "inject": "icon_html" }
  ]
}
```

> [!TIP]
> Multiple components? Add multiple `reactor` entries, each with its own `inject` name, and use
> each in the templates that need it.

Next: [A complete React static site](react-static-site).
