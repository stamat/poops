---
layout: docs
title: Build a React App
navTitle: Build a React App
description: Build a plain client-rendered React SPA with Poops — one scripts entry, createRoot, done.
order: 3
keywords: ["react", "spa", "app", "createRoot", "client", "scripts", "jsx", "tsx"]
---

# Build a React App

When you want a straightforward client-rendered single-page app — no build-time rendering, no
hydration — Poops is just your bundler. One `scripts` entry points at your JSX/TSX entry, esbuild
does the rest.

## Project layout

```text
react-app/
├─ poops.json
├─ package.json          # react + react-dom installed here
└─ src/
   ├─ scss/index.scss
   ├─ js/
   │  ├─ main.tsx         # entry: mounts the app
   │  ├─ App.tsx
   │  └─ components/
   └─ markup/
      └─ index.html       # the shell with <div id="root">
```

## The entry

```tsx
// src/js/main.tsx
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

```tsx
// src/js/App.tsx
import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  return (
    <main>
      <h1>Hello from Poops</h1>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
    </main>
  )
}
```

## The config

```json
{
  "scripts": [
    {
      "in": "src/js/main.tsx",
      "out": "dist/js/app.js",
      "options": { "minify": true, "format": "iife", "target": "es2019", "jsx": "automatic" }
    }
  ],
  "styles": [
    { "in": "src/scss/index.scss", "out": "dist/css/styles.css", "options": { "minify": true } }
  ],
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "site": { "title": "My React App" },
    "includePaths": ["_layouts", "_partials"]
  },
  "copy": [{ "in": "src/static", "out": "dist" }],
  "serve": { "port": 4040, "base": "/dist" },
  "livereload": true,
  "watch": ["src"]
}
```

`"jsx": "automatic"` enables React 17+'s JSX runtime, so you don't `import React` in every file.

## The HTML shell

Poops still builds your `index.html` — use `markup` for the shell so `relativePathPrefix` and
`site` data work:

```html
{% raw %}<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{ site.title }}</title>
  <link rel="stylesheet" href="{{ relativePathPrefix }}css/styles.min.css">
</head>
<body>
  <div id="root"></div>
  <script src="{{ relativePathPrefix }}js/app.min.js"></script>
</body>
</html>{% endraw %}
```

> [!NOTE]
> Install React in your project: `npm i react react-dom`. Poops resolves it from your
> `node_modules` — it isn't a Poops dependency.

## Develop and build

```bash
poops        # watch + serve + livereload at http://localhost:4040
poops -b     # one-off production build into dist/
```

> [!TIP]
> This is a pure SPA: nothing renders until the JS loads. If you want real HTML on first paint
> (better SEO and perceived speed), pre-render with Reactor instead — see
> [A complete React static site](../static-site/react-static-site).

> [!INFO]
> For a library rather than an app — shipping ESM/CJS/IIFE builds of your components — see
> [Transpiling JavaScript › Maintaining a JS library](../quick-start/transpiling-js).
