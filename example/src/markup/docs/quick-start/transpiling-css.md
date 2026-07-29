---
layout: poops-docs-theme/docs
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

- **`in`** — a `.scss`/`.sass` entry file, an array of entry files, or a [glob pattern](#globs-and-multiple-entry-files).
- **`out`** — the output CSS file, a directory when `in` has multiple entries, or a
  [template](#naming-outputs-yourself) naming one output per entry.

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

## Globs and multiple entry files

`in` also accepts a glob pattern or an array of entry files — handy when every top-level
stylesheet should become its own CSS file (theme sections, per-page styles, …):

```json
{
  "styles": [
    { "in": "src/scss/*.scss", "out": "dist/css/",
      "options": { "minify": true } }
  ]
}
```

Each matched file compiles separately to `dist/css/<name>.css`. Sass partials (`_*.scss`) are
skipped — they're imports, not entry points. Arrays and globs mix freely:

```json
{ "in": ["src/scss/main.scss", "src/scss/pages/*.scss"], "out": "dist/css/" }
```

Brace alternates count as a glob on their own, so a pattern needs no `*` to match "whichever
extension this entry happens to use":

```json
{ "in": "src/scss/pages/*.{scss,sass,css}", "out": "dist/css/" }
```

> [!NOTE]
> With more than one entry file, `out` must be a directory. Output names come from the input's
> basename, so two entries named `main.scss` in different directories would overwrite each other.
> Glob patterns always use `/` as the separator, even on Windows.

### One stylesheet per component directory

Libraries of components usually give each component a directory, which makes every entry point
`index.*` — and by the basename rule above, every one of them would compile to `index.css` and
overwrite the last. A **glob-matched** `index.*` is named after the directory holding it instead:

```json
{ "in": "src/elements/*/index.{scss,sass,css}", "out": "dist/css/" }
```

```
src/elements/accordion/index.scss  →  dist/css/accordion.css
src/elements/tabs/index.scss       →  dist/css/tabs.css
```

Add a component directory, get a stylesheet — no config change. The rename only applies to entries
a glob matched: a literal `"in": "src/scss/index.scss"` still writes `index.css`, and an explicit
`out` file path always wins.

The name is placed relative to the glob's **static prefix** — everything before the first `*`, `{…}`
or other magic segment. Above that prefix is `src/elements`, which every match shares, so nothing is
left to nest under and the output is flat. Widen the glob and the part it no longer pins down is
kept, so same-named components stay apart instead of overwriting each other:

```json
{ "in": "src/*/accordion/index.scss", "out": "dist/css/" }
```

```
src/blocks/accordion/index.scss    →  dist/css/blocks/accordion.css
src/elements/accordion/index.scss  →  dist/css/elements/accordion.css
```

> [!NOTE]
> The prefix comes from the pattern, not from what matched, so the layout doesn't shift when you
> add or remove a component. This is the one place styles nest — non-`index` entries still flatten
> to their basename, per the rule above.

### Naming outputs yourself

The `index.*` rule only rescues entry points actually named `index`. Every other glob match still
flattens to its own basename, so `src/elements/*/theme.scss` writes `theme.css` once per component
and the last one wins. When you need a different name, `out` can be a **template**:

- **`{% raw %}{{dir}}{% endraw %}`** — the match's directory, relative to the glob's static prefix
  (the same name an `index.*` entry would get)
- **`{% raw %}{{name}}{% endraw %}`** — the match's basename without extension

```json
{% raw %}{ "in": "src/elements/*/theme.scss", "out": "dist/css/{{dir}}-{{name}}.css" }{% endraw %}
```

```
src/elements/accordion/theme.scss  →  dist/css/accordion-theme.css
src/elements/tabs/theme.scss       →  dist/css/tabs-theme.css
```

One output per match instead of one shared output. Tokens may carry spaces (`{% raw %}{{ dir }}{% endraw %}`)
and can appear in directory segments too, so `{% raw %}"out": "dist/css/{{dir}}/theme.css"{% endraw %}`
writes `dist/css/accordion/theme.css`. A templated `out` is exempt from the "more than one entry file
needs a directory" rule — it already resolves to a different file per entry.

For a literal entry, `{% raw %}{{dir}}{% endraw %}` is that entry's own directory name, so mixed
arrays keep working:

```json
{% raw %}{ "in": ["src/scss/main.scss", "src/elements/accordion/index.scss"], "out": "dist/css/{{dir}}.css" }{% endraw %}
```

```
src/scss/main.scss                 →  dist/css/scss.css
src/elements/accordion/index.scss  →  dist/css/accordion.css
```

> [!NOTE]
> A template wins over the `index.*` rename — you named the outputs, so nothing renames them behind
> your back. A template that can't tell two matches apart
> (`{% raw %}"out": "dist/css/{{name}}.css"{% endraw %}` across component directories) collides just
> like a plain directory `out` would — that's what `{% raw %}{{dir}}{% endraw %}` is for. Scripts
> take the same templates — see [Transpiling JS](transpiling-js#naming-outputs-yourself).

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
