---
layout: docs
title: Transpiling JavaScript
navTitle: Transpiling JS
description: Bundle and transpile JS, TS, JSX and TSX with esbuild — including maintaining a JS library across IIFE, ESM and CJS.
order: 2
keywords: ["javascript", "typescript", "esbuild", "iife", "esm", "cjs", "transpile", "library"]
---

# Transpiling JavaScript

The `scripts` key bundles and transpiles JavaScript with [esbuild](https://esbuild.github.io/).
It handles `.js`, `.ts`, `.jsx` and `.tsx` out of the box — TypeScript and JSX need no extra
setup.

## A single script

```json
{
  "scripts": [
    {
      "in": "src/js/main.ts",
      "out": "dist/js/scripts.js",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false,
        "format": "iife",
        "target": "es2019"
      }
    }
  ]
}
```

Each entry has `in`, `out` and `options`:

- **`in`** — an entry file, an array of entry files, or a [glob pattern](#globs-and-multiple-entry-files).
- **`out`** — the output file, or a directory when `in` has multiple entries.
- **`options`** — mostly passed straight through to esbuild.

### Options

| Option | Meaning |
| --- | --- |
| `sourcemap` | Emit a source map. Only for the non-minified output. Default `false`. |
| `minify` | Also emit a minified file. Default `false`. |
| `justMinified` | Emit **only** the minified file. Great for production. Default `false`. |
| `format` | `iife`, `esm` or `cjs`. |
| `target` | e.g. `es2018`, `es2019`, `esnext`. |
| `jsx` | `transform` (default) or `automatic` (React 17+ runtime). |

> [!TIP]
> `minify: true` with `justMinified: false` emits **both** `scripts.js` and `scripts.min.js` in
> one pass — because everyone forgets to build the minified bundle for production.

## Multiple scripts

Pass an array to bundle several entries:

```json
{
  "scripts": [
    { "in": "src/js/main.ts", "out": "dist/js/scripts.js",
      "options": { "minify": true, "format": "iife", "target": "es2019" } },
    { "in": "src/js/admin.ts", "out": "dist/js/admin.js",
      "options": { "minify": true, "format": "iife", "target": "es2019" } }
  ]
}
```

## Globs and multiple entry files

`in` also accepts a glob pattern or an array of entry files — each becomes its own bundle,
handy for per-page scripts or theme sections:

```json
{
  "scripts": [
    { "in": "src/js/pages/*.js", "out": "dist/js/",
      "options": { "minify": true, "format": "iife" } }
  ]
}
```

Arrays and globs mix freely:

```json
{ "in": ["src/js/main.ts", "src/js/pages/*.ts"], "out": "dist/js/" }
```

> [!NOTE]
> With more than one entry file, `out` must be a directory. Entry points from different
> directories nest their output under their common ancestor — `src/js/a/main.js` and
> `src/js/b/main.js` become `dist/js/a/main.js` and `dist/js/b/main.js`, so same-named
> entries never collide. Glob patterns always use `/` as the separator, even on Windows.

## Maintaining a JS library

Poops is genuinely good at library work: author once in TypeScript, ship every module format
your users need. The trick is one `scripts` entry per target `format`, all reading the same
entry file.

```json
{% raw %}{
  "scripts": [
    { "in": "src/index.ts", "out": "dist/mylib.esm.js",
      "options": { "format": "esm", "target": "es2019", "minify": true } },
    { "in": "src/index.ts", "out": "dist/mylib.cjs.js",
      "options": { "format": "cjs", "target": "es2019", "minify": true } },
    { "in": "src/index.ts", "out": "dist/mylib.global.js",
      "options": { "format": "iife", "target": "es2019", "minify": true } }
  ],
  "banner": "/* {{ name }} v{{ version }} | {{ homepage }} | {{ license }} License */"
}{% endraw %}
```

That gives you:

- **TypeScript → vanilla JS** — esbuild strips the types and downlevels to your `target`.
- **ESM** for modern bundlers and `<script type="module">`.
- **CJS** for `require()` in Node.
- **IIFE (global)** for a plain `<script>` tag with a global variable.

Wire the outputs into `package.json` so consumers get the right one automatically:

```json
{
  "main": "dist/mylib.cjs.js",
  "module": "dist/mylib.esm.js",
  "browser": "dist/mylib.global.min.js",
  "types": "dist/index.d.ts"
}
```

> [!NOTE]
> esbuild does not emit `.d.ts` type declarations. If you ship types, generate them separately
> with `tsc --emitDeclarationOnly`. That is a one-line npm script beside your Poops build.

> [!INFO]
> The `banner` option stamps a comment on top of every output, templated from your `package.json`
> — `name`, `version`, `homepage`, `license`, `author`, `description`. See the
> [configuration reference](../config-reference) for details.

Next: [Transpiling CSS](transpiling-css).
