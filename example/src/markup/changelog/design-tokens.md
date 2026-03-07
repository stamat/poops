---
layout: blog
title: Design Token Support for Sass
date: 2026-03-07
description: Import JSON design tokens directly into your SCSS files. Supports W3C DTCG and Style Dictionary formats with alias resolution, flat variables, and Sass map output.
published: true
---

# {{ page.title }}

> {{ page.description }}

### What's new?

Poops now integrates [`sass-token-importer`](https://github.com/stamat/sass-token-importer), a custom Dart Sass importer that lets you `@use` JSON token files as if they were SCSS modules. Define your design tokens in JSON once and use them everywhere — no manual SCSS variable files to keep in sync.

### Getting started

Create a tokens directory with your JSON token files. Both [W3C DTCG](https://design-tokens.github.io/community-group/format/) and [Style Dictionary](https://amzn.github.io/style-dictionary/) formats are auto-detected.

**`tokens/colors.json`** (W3C DTCG format):

```json
{
  "color": {
    "$type": "color",
    "primary": { "$value": "#0066cc" },
    "secondary": { "$value": "#ff6600" },
    "accent": { "$value": "#9b59b6" },
    "text": { "$value": "#333333" },
    "background": { "$value": "#f5f5f5" },
    "link": { "$value": "{color.primary}" }
  }
}
```

**`tokens/spacing.json`**:

```json
{
  "spacing": {
    "$type": "dimension",
    "xs": { "$value": "4px" },
    "sm": { "$value": "8px" },
    "md": { "$value": "16px" },
    "lg": { "$value": "32px" },
    "xl": { "$value": "64px" }
  }
}
```

Add `tokenPaths` to your styles config in `poops.json`:

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

Then use the `token:` prefix in your SCSS to import them:

```scss
@use "token:colors" as c;
@use "token:spacing" as s;

.token-test {
  color: c.$color-primary;
  background-color: c.$color-background;

  a {
    color: c.$color-link;

    &:hover {
      color: c.$color-secondary;
    }
  }

  padding: s.$spacing-md;
  margin-bottom: s.$spacing-lg;

  &__header {
    color: c.$color-accent;
    padding: s.$spacing-sm s.$spacing-md;
  }

  &__body {
    color: c.$color-text;
    padding: s.$spacing-md;
    gap: s.$spacing-xs;
  }
}
```

### Alias resolution

Token values can reference other tokens using curly-brace syntax. In the example above, `link` resolves to the value of `color.primary` (`#0066cc`). Chained aliases are resolved in topological order, and circular references throw an error. Disable with `"resolveAliases": false` in your options.

### Output modes

By default, tokens are generated as flat SCSS variables (`$color-primary: #0066cc`). Set `"tokenOutput": "map"` to generate nested Sass maps instead:

```json
{
  "options": {
    "tokenPaths": ["src/tokens"],
    "tokenOutput": "map"
  }
}
```

```scss
@use "sass:map";
@use "token:colors" as c;

.btn {
  color: map.get(c.$color, primary);
}
```

### Supported token types

| Type          | Example                       | SCSS Output                      |
| ------------- | ----------------------------- | -------------------------------- |
| `color`       | `"#0066cc"`                   | `#0066cc`                        |
| `dimension`   | `"16px"`                      | `16px`                           |
| `fontFamily`  | `["Helvetica", "sans-serif"]` | `("Helvetica", sans-serif)`      |
| `fontWeight`  | `700`                         | `700`                            |
| `duration`    | `"200ms"`                     | `200ms`                          |
| `cubicBezier` | `[0.42, 0, 0.58, 1]`          | `cubic-bezier(0.42, 0, 0.58, 1)` |
| `typography`  | composite                     | Sass map                         |
| `shadow`      | composite                     | Sass map                         |
| `border`      | composite                     | Sass map                         |

### Multiple token directories

Point to multiple directories if your tokens are split across packages or folders:

```json
{
  "options": {
    "tokenPaths": ["src/tokens", "node_modules/@my-org/tokens/dist"]
  }
}
```

### The `token:` prefix

The `token:` prefix explicitly targets the token importer, avoiding ambiguity when you have both a `colors.json` token file and a `_colors.scss` partial. Without it, Sass tries importers in registration order — which works, but the prefix makes the intent clear.
