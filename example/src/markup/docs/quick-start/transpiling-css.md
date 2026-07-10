---
layout: docs
title: Transpiling CSS
navTitle: Transpiling CSS
description: Compile SCSS/Sass with Dart Sass, and import JSON design tokens directly into your styles.
order: 3
keywords: ["css", "scss", "sass", "dart-sass", "design tokens", "sourcemap"]
---

# Transpiling CSS

The `styles` key compiles SCSS/Sass with [Dart Sass](https://sass-lang.com/dart-sass) — the
fastest, most up-to-date Sass implementation.

## A single stylesheet

```json
{
  "styles": [
    {
      "in": "src/scss/index.scss",
      "out": "dist/css/styles.css",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false
      }
    }
  ]
}
```

- **`in`** — a single `.scss`/`.sass` entry file.
- **`out`** — the output CSS file.

### Options

| Option | Meaning |
| --- | --- |
| `sourcemap` | Emit a source map (non-minified output only). Default `false`. |
| `minify` | Also emit a minified CSS file (via esbuild). Default `false`. |
| `justMinified` | Emit only the minified file. Default `false`. |
| `tokenPaths` | Directories of JSON design tokens to expose to Sass. |
| `tokenOutput` | `variables` (default) or `map`. |
| `resolveAliases` | Resolve `{path.to.token}` references. Default `true`. |

> [!TIP]
> Like scripts, `minify: true` gives you both `styles.css` and `styles.min.css` in one build —
> readable CSS for dev, minified for production.

## Multiple stylesheets

```json
{
  "styles": [
    { "in": "src/scss/main.scss", "out": "dist/css/styles.css",
      "options": { "sourcemap": true, "minify": true } },
    { "in": "src/scss/admin.scss", "out": "dist/css/admin.css",
      "options": { "minify": true } }
  ]
}
```

## Resolving imports

`node_modules` is on the include path by default, so you can `@use` packages directly:

```scss
@use "some-design-system/scss/base";
```

If you set `includePaths` at the top level of your config, include `node_modules` yourself — the
setting replaces the default rather than adding to it.

## Design tokens

Define your tokens once as JSON and `@use` them straight from SCSS via the `token:` prefix. Both
[W3C DTCG](https://design-tokens.github.io/community-group/format/) and
[Style Dictionary](https://amzn.github.io/style-dictionary/) formats are auto-detected.

Given `src/tokens/colors.json`:

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

Point `tokenPaths` at the directory:

```json
{
  "styles": [
    { "in": "src/scss/index.scss", "out": "dist/css/styles.css",
      "options": { "tokenPaths": ["src/tokens"] } }
  ]
}
```

Then use them as flat variables:

```scss
@use "token:colors" as c;

.btn { color: c.$color-primary; }
.btn:hover { color: c.$color-secondary; }
a { color: c.$color-link; } // resolved from {color.primary} → #0066cc
```

Prefer Sass maps? Set `"tokenOutput": "map"`:

```scss
@use "sass:map";
@use "token:colors" as c;

.btn { color: map.get(c.$color, primary); }
```

> [!NOTE]
> Design tokens keep a single source of truth for your color/spacing/typography scales, shared
> across Sass here and anything else that reads the same JSON — no hand-maintained variable file
> to drift out of sync.

Need Tailwind or another PostCSS plugin instead of (or alongside) Sass? See
[PostCSS & Tailwind](postcss-tailwind).

Next: [Templating HTML](templating-html).
