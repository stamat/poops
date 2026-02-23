---
layout: blog
title: React JSX Support
date: 2026-02-23
description: Poops now supports bundling .jsx and .tsx React files out of the box. Powered by esbuild, you can bundle React components with zero extra configuration.
published: true
---

# {{ page.title }}

> {{ page.description }}

### What's new?

JSX and TSX files are now first-class citizens in Poops. Since esbuild handles JSX natively, all you need to do is point your entry to a `.jsx` or `.tsx` file and Poops takes care of the rest.

[Demo &rarr;](https://stamat.info/poops/react.html)

### Example configuration

```json
{
  "scripts": [
    {
      "in": "src/js/react-app.jsx",
      "out": "dist/js/react-app.js",
      "options": {
        "minify": true,
        "format": "iife"
      }
    }
  ]
}
```

### Advanced JSX options

You can pass any esbuild JSX option through the `options` object. For example, to use React's automatic JSX runtime:

```json
{
  "options": {
    "jsx": "automatic"
  }
}
```

### React APP example 👇

<div id="root">{{ app_html | safe }}</div>
<script async type="text/javascript" src="{{ relativePathPrefix }}js/app-hydrate.min.js"></script>
