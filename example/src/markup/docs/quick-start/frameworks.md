---
layout: docs
title: Use with WordPress, Laravel, Rails, Django…
navTitle: Use with frameworks
description: Poops is just a bundler — point it at your framework's asset folders and use it as the front-end toolchain for WordPress, Laravel, Rails, Django and more.
order: 5
keywords: ["wordpress", "laravel", "rails", "django", "framework", "assets", "toolchain"]
---

# Use with WordPress, Laravel, Rails, Django…

Poops does not own your project. It reads input paths and writes output paths — so it slots in as
the **front-end asset toolchain** for any server-side framework. Your framework serves the pages;
Poops builds the CSS and JS.

The pattern is always the same: keep your sources somewhere sensible, and point `out` at wherever
your framework serves static assets from.

## WordPress

Build into your theme directory:

```json
{
  "scripts": [
    { "in": "assets/js/theme.ts", "out": "wp-content/themes/mytheme/js/theme.js",
      "options": { "minify": true, "format": "iife", "target": "es2019" } }
  ],
  "styles": [
    { "in": "assets/scss/theme.scss", "out": "wp-content/themes/mytheme/css/theme.css",
      "options": { "minify": true } }
  ],
  "watch": ["assets"],
  "livereload": true
}
```

Then `wp_enqueue_style`/`wp_enqueue_script` the built files from your theme. Skip Poops' `markup`
key entirely — WordPress renders the HTML.

## Laravel

Replace Vite/Mix for simple projects. Build into `public/`:

```json
{
  "scripts": [
    { "in": "resources/js/app.ts", "out": "public/js/app.js",
      "options": { "minify": true, "format": "iife", "target": "es2019" } }
  ],
  "styles": [
    { "in": "resources/scss/app.scss", "out": "public/css/app.css",
      "options": { "minify": true } }
  ],
  "watch": ["resources"]
}
```

Reference them with `asset('css/app.css')` in your Blade templates.

## Ruby on Rails

Build into `app/assets/builds/` (or `public/`) and let the asset pipeline or `propshaft` pick them
up:

```json
{
  "scripts": [
    { "in": "app/javascript/application.ts", "out": "app/assets/builds/application.js",
      "options": { "minify": true, "format": "esm", "target": "es2019" } }
  ],
  "styles": [
    { "in": "app/assets/stylesheets/application.scss", "out": "app/assets/builds/application.css",
      "options": { "minify": true } }
  ],
  "watch": ["app/javascript", "app/assets/stylesheets"]
}
```

## Django

Build into a `static/` directory that `collectstatic` will gather:

```json
{
  "scripts": [
    { "in": "frontend/js/main.ts", "out": "myapp/static/js/main.js",
      "options": { "minify": true, "format": "iife", "target": "es2019" } }
  ],
  "styles": [
    { "in": "frontend/scss/main.scss", "out": "myapp/static/css/main.css",
      "options": { "minify": true } }
  ],
  "watch": ["frontend"]
}
```

Load them with `{% raw %}{% static 'css/main.css' %}{% endraw %}` in your Django templates.

> [!TIP]
> Run `poops` (no `-b`) in a second terminal during development for a watch + LiveReload loop
> while your framework's own dev server serves the app. Use `poops -b` in your build/CI step.

> [!WARNING]
> When you use Poops purely as a bundler, drop the `markup`, `serve` and (usually) `copy` keys.
> Let the framework handle routing, HTML and static file serving — Poops only produces the asset
> bundles.

> [!INFO]
> The same approach works for Rails/Django/Laravel or anything else: Symfony, Phoenix, Express,
> Hugo, plain PHP. If it serves files from a folder, Poops can fill that folder.

Next: [PostCSS & Tailwind](postcss-tailwind).
