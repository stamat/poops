# 💩 Poops [![npm version](https://img.shields.io/npm/v/poops)](https://www.npmjs.com/package/poops)

Straightforward, no-bullshit bundler for the web.

> When your day is long
>
> And the night, the night is yours alone
>
> When you're sure you've had enough
>
> Of these bundlers, well hang on
>
> Don't let yourself go
>
> 'Cause everybody poops
>
> Everybody poops sometimes

[R.E.M. - Everybody Poops :poop:](https://www.youtube.com/watch?v=5rOiW_xY-kc)

---

Intuitive with a minimal learning curve and minimal docs, utilizing the most efficient transpilers and compilers available (like [dart-sass](https://sass-lang.com/dart-sass) and [esbuild](https://esbuild.github.io/)) Poops aims to be the simplest bundler option there is. If it's not, please do contribute so we can make it so! 🙏 All ideas and contributions are welcome.

It uses a simple config file where you define your input and output paths and it poops out your bundled files. Simple as that.

## Features

- Bundles SCSS/SASS to CSS
- Uses [dart-sass](https://sass-lang.com/dart-sass) for SCSS/SASS bundling
- Bundles JS/TS/JSX/TSX to IIFE/ESM/CJS
- Uses [esbuild](https://esbuild.github.io/) for bundling and transpiling JS/TS/JSX/TSX to IIFE/ESM/CJS
- React pre-rendering (Reactor) — renders React components to HTML at build time for static sites with optional hydration
- Optional JS and CSS minification using [esbuild](https://esbuild.github.io/)
- Can produce minified code simultaneously with non-minified code! (cause I always forget to minify my code for production)
- Supports source maps only for non minified - non production code (optional)
- Supports multiple input and output paths
- Resolves node modules
- Can add a templatable banner to output files (optional)
- Static site generation with [nunjucks](https://mozilla.github.io/nunjucks/) templating, with blogging option (optional)
- Has a configurable local server (optional)
- Rebuilds on file changes (optional)
- Live reloads on file changes (optional)

## Quick Start

> For a superfast start, you can use the Poops template repository: [💩🌪️Shitstorm](https://github.com/stamat/shitstorm)

You can install Poops globally:

```bash
npm i -g poops
```

or locally:

```bash
npm i -D poops
```

If you have installed Poops globally, create a `poops.json` or `💩.json` configuration file in the project root (see [Configuration](#configuration) on how to configure) and run:

`poops` or `💩`

or pass a custom config. This is useful when you have multiple environments:

`poops yourAwesomeConfig.json` or `💩 yourAwesomeConfig.json`

If you have installed Poops locally you can run it with `npx poops` or `npx 💩` or add a script to your `package.json`:

```json
{
  "scripts": {
    "build": "npx poops" // or "npx 💩"
  }
}
```

## Configuration

Configuring Poops is simple 😌. Let's presume that we have a `example/src/scss` and `example/src/js` directories and we want to bundle the files into `example/dist/css` and `example/dist/js`. If you also have markup files, you can use [nunjucks](https://mozilla.github.io/nunjucks/) templating engine to generate HTML files from your templates. Let's presume that we have a `example/src/markup` directory and we want to generate HTML files in the root of the your directory.

Just create a `poops.json` file in the root of your project and add the following (you can see this sample config in this repo's root):

```json
{
  "scripts": [
    {
      "in": "example/src/js/main.ts",
      "out": "example/dist/js/scripts.js",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false,
        "format": "iife",
        "target": "es2019"
      }
    }
  ],
  "reactor": [
    {
      "component": "example/src/js/App.jsx",
      "inject": "app_html",
      "in": "example/src/js/app-hydrate.jsx",
      "out": "example/dist/js/app-hydrate.js",
      "options": {
        "minify": true,
        "target": "es2019"
      }
    }
  ],
  "styles": [
    {
      "in": "example/src/scss/index.scss",
      "out": "example/dist/css/styles.css",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false
      }
    }
  ],
  "markup": {
    "in": "example/src/markup",
    "out": "/",
    "options": {
      "site": {
        "title": "Poops",
        "description": "A super simple bundler for simple web projects."
      },
      "data": [
        "example/src/markup/data/links.json",
        "example/src/markup/data/poops.yaml"
      ],
      "includePaths": [
        "example/src/markup/_layouts",
        "example/src/markup/_partials"
      ]
    }
  },
  "copy": [
    {
      "in": "example/src/static",
      "out": "example/dist"
    }
  ],
  "banner": "/* {{ name }} v{{ version }} | {{ homepage }} | {{ license }} License */",
  "serve": {
    "port": 4040,
    "base": "/"
  },
  "livereload": true,
  "watch": ["src"],
  "includePaths": ["node_modules"]
}
```

All config properties are optional except `scripts`, `styles` or `markups`. You have to specify at least one of them. If you don't have anything to consume, you won't poop. 💩

You can freely remove the properties that you don't need. For example, if you don't want to run a local server, just remove the `serve` property from the config.

### Scripts

Scripts are bundled with [esbuild](https://esbuild.github.io/). Supports `.js`, `.ts`, `.jsx`, and `.tsx` files out of the box — including React and other JSX frameworks. You can specify multiple scripts to bundle. Each script has the following properties:

- `in` - the input path, can be an array of file paths, but please just use one file path per script
- `out` - the output path, can be a directory or a file path, but please just use it as a filename
- `options` - the options for the bundler. You can apply most of the esbuild options that are not in conflict with Poops. See [esbuild's options](https://esbuild.github.io/api/#build-api) for more info.

**Options:**

- `sourcemap` - whether to generate sourcemaps or not, sourcemaps are generated only for non-minified files since they are useful for debugging. Default is `false`. This is a direct esbuild option
- `minify` - whether to minify the output or not, minification is performed by `esbuild` and is only applied to non-minified files. Default is `false`
- `justMinified` - whether you want to have a minified file as output only. Removes the non-minified file from the output. Useful for production builds. Default is `false`
- `format` - the output format, can be `iife` or `esm` or `cjs` - this is a direct esbuild option
- `target` - the target for the output, can be `es2018` or `es2019` or `es2020` or `esnext` for instance - this is a direct esbuild option
- `jsx` - the JSX transform mode, can be `transform` (default) or `automatic`. Use `automatic` for React 17+ JSX runtime which doesn't require importing React in every file - this is a direct esbuild option

`scripts` property can accept an array of script configurations or just a single script configuration. If you want to bundle multiple scripts, just add them to the `scripts` array:

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
    },
    {
      "in": "src/js/other.ts",
      "out": "dist/js/other.js",
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

#### JSX/TSX (React) Example

To bundle a React app, just point `in` to your `.jsx` or `.tsx` entry file:

```json
{
  "scripts": [
    {
      "in": "src/js/app.jsx",
      "out": "dist/js/app.js",
      "options": {
        "minify": true,
        "format": "iife",
        "jsx": "automatic"
      }
    }
  ]
}
```

Setting `jsx` to `automatic` uses React's JSX runtime (React 17+), so you don't need `import React from 'react'` in every file. If you omit `jsx` or set it to `transform`, the classic `React.createElement` transform is used.

As noted earlier, if you don't want to bundle scripts, just remove the `scripts` property from the config.

### Reactor (React Pre-rendering)

The `reactor` config key defines React components that are pre-rendered to HTML at build time (SSG) and optionally hydrated on the client. This is a separate pipeline from `scripts` — reactor entries have their own build step, watcher path, and logging tag.

Each reactor entry has the following properties:

- `component` — the file that default-exports a React component (rendered at build time with `renderToString`)
- `inject` — Nunjucks global variable name for the rendered HTML
- `in` (optional) — client entry file for hydration (bundled for the browser)
- `out` (optional) — output path for the client bundle
- `options` (optional) — esbuild options for the client bundle (same as script entries: `minify`, `format`, `target`, `sourcemap`, etc.)

```json
{
  "reactor": [
    {
      "component": "src/js/App.jsx",
      "inject": "app_html",
      "in": "src/js/app-hydrate.jsx",
      "out": "dist/js/app-hydrate.js",
      "options": {
        "minify": true,
        "target": "es2019"
      }
    }
  ]
}
```

For backwards compatibility, `"ssg"` is also accepted as a config key — it is treated as an alias for `"reactor"`.

In your Nunjucks templates, use the `inject` name to insert the rendered HTML:

```html
<div id="root">{{ app_html | safe }}</div>
<script src="js/app-hydrate.min.js"></script>
```

If you only need server-side rendering without client hydration, omit `in` and `out`:

```json
{
  "reactor": [
    {
      "component": "src/js/App.jsx",
      "inject": "app_html"
    }
  ]
}
```

**How it works:**

1. Poops bundles the component with `react-dom/server` for Node.js and calls `renderToString`
2. The rendered HTML is stored and made available as a Nunjucks global variable
3. If `in`/`out` are specified, the client entry is bundled for the browser
4. At runtime, React hydrates the pre-rendered HTML, making it interactive

Poops does not need `react` or `react-dom` as its own dependency — they are resolved from your project's `node_modules`. In watch mode, changes to files in the reactor component's directory trigger re-rendering and client re-bundling. Markup is recompiled only when the rendered output actually changes. Changes to other JS/TS files only trigger the scripts pipeline — the two are independent.

**Note:** If you don't need server-side pre-rendering, you can bundle a React app entirely through the regular `scripts` pipeline — just point `in` to your `.jsx`/`.tsx` entry file and use `createRoot` on the client. The `reactor` config is only needed when you want build-time HTML rendering with optional hydration.

### Styles

Styles are bundled with [Dart Sass](https://sass-lang.com/dart-sass). You can specify multiple styles to bundle. Each style has the following properties:

- `in` - the input path, accepts only a path to a file
- `out` - the output path, can be a directory or a file path, but please just use it as a filename
- `options` - the options for the bundler.

**Options:**

- `sourcemap` - whether to generate sourcemaps or not, sourcemaps are generated only for non-minified files since they are useful for debugging. Default is `false`
- `minify` - whether to minify the output or not, minification is performed by `esbuild`. Default is `false`
- `justMinified` - whether you want to have a minified file as output only. Removes the non-minified file from the output. Useful for production builds. Defaults to `false`.

`styles` property can accept an array of style configurations or just a single style configuration. If you want to bundle multiple styles, just add them to the `styles` array:

```json
{
  "styles": [
    {
      "in": "src/scss/main.scss",
      "out": "dist/css/styles.css",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false
      }
    },
    {
      "in": "src/scss/other.scss",
      "out": "dist/css/other.css",
      "options": {
        "sourcemap": true,
        "minify": true,
        "justMinified": false
      }
    }
  ]
}
```

As noted earlier, if you don't want to bundle styles, just remove the `styles` property from the config.

### Markups

- `in` - the input path, can be a directory or a file path, but please just use it as a directory path for now. All files in this directory will be processed and the structure of the directory will be preserved in the output directory with exception to directories that begin with an underscore `_` will be ignored.
- `out` - the output path, can be only a directory path (for now)
- `site` (optional) - global data that will be available to all templates in the markup directory. Like site title, description, social media links, etc. You can then use this data in your templates `{{ site.title }}` for instance.
- `data` (optional) - is an array of JSON or YAML data files, that once loaded will be available to all templates in the markup directory. If you provide a path to a file for instance `links.json` with a `facebook` property, you can then use this data in your templates `{{ links.facebook }}`. The base name of the file will be used as the variable name, with spaces, dashes and dots replaced with underscores. So `the awesome-links.json` will be available as `{{ the_awesome_links.facebook }}` in your templates. The root directory of the data files is `in` directory. So if you have a `data` directory in your `in` directory, you can specify the data files like this `data: ["data/links.json"]`. The same goes for the YAML files.
- `includePaths` - an array of paths to directories that will be added to the nunjucks include paths. Useful if you want to separate template partials and layouts. For instance, if you have a `_includes` directory with a `header.njk` partial that you want to include in your markup, you can add it to the include paths and then include the templates like this `{% include "header.njk" %}`, without specifying the full path to the partial. This will change in the future, to provide better ignore and include patterns for the markup directories.

**💡 NOTE:** If, for instance, you are building a simple static onepager for your library, and want to pass a version variable from your `package.json`, Poops automatically reads your `package.json` if it exists in your working directory and sets the global variable `package` to the parsed JSON. So you can use it in your markup files, for example like this: `{{ package.version }}`.

Here is a sample markup configuration:

```JSON
{
  "markups": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "site": {
        "title": "My Awesome Site",
        "description": "This is my awesome site"
      },
      "data": [
        "data/links.json",
        "data/other.yaml"
      ],
      "includePaths": [
        "_includes"
      ]
    }
  }
}
```

If your project doesn't have markups, you can remove the `markups` property from the config entirely. No code will be executed for this property.

#### Custom Extensions

##### image

Poops can generate responsive `<img>` elements with `srcset` attributes. Image processing (resize, format conversion) is handled externally — Poops discovers the generated variants on disk and produces the correct HTML markup.

**Naming convention:** Your image tool should output variants as `{name}-{width}w.{ext}`. For example, given `photo.jpg`, the expected variants are: `photo-320w.jpg`, `photo-640w.jpg`, `photo-320w.webp`, `photo-640w.webp`, etc.

**`{% image %}` tag** — generates a full `<img>` element:

```html
{% image 'static/photo.jpg', alt='Hero', class='hero-img', sizes='(max-width:
640px) 100vw, 50vw' %}
```

Output:

```html
<img
  src="static/photo-640w.jpg"
  srcset="
    static/photo-320w.webp 320w,
    static/photo-640w.webp 640w,
    static/photo-960w.webp 960w
  "
  sizes="(max-width: 640px) 100vw, 50vw"
  alt="Hero"
  class="hero-img"
  loading="lazy"
/>
```

- Scans the output directory for files matching `{name}-{width}w.{ext}`
- Groups by format, prefers `avif` > `webp` > original format for srcset
- Uses the middle-sized variant as `src` fallback
- Prepends `relativePathPrefix` automatically
- Defaults: `sizes="100vw"`, `loading="lazy"`
- Falls back to a plain `<img src="...">` if no variants are found

##### googleFonts

Generates Google Fonts `<link>` tags with preconnect hints. Accepts an array of font names (strings) or font objects with weight/italic options.

```nunjucks
{% googleFonts ["Open Sans", "Roboto"] %}
```

Output:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Open+Sans&family=Roboto&display=swap"
  rel="stylesheet"
/>
```

With specific weights and italics:

```nunjucks
{% googleFonts ["DM Sans", {name: "Poppins", weights: [400, 700], ital: true}] %}
```

Options:

- `name` — font family name
- `weights` — array of weight values (e.g. `[400, 700]`)
- `ital` — set to `true` to include italic variants
- `display` — font-display strategy, defaults to `swap`

##### highlight

Syntax-highlights code blocks at build time using [highlight.js](https://highlightjs.org/), eliminating layout shift caused by client-side highlighting. Code is pre-highlighted in the HTML output — you only need the highlight.js CSS theme on the client, not the JS.

**`{% highlight %}` tag** — wraps a code block with syntax highlighting:

```nunjucks
{% highlight 'javascript' %}
const greet = (name) => {
  return `Hello, ${name}!`;
};
{% endhighlight %}
```

Output:

```html
<pre><code class="hljs language-javascript"><span class="hljs-keyword">const</span> greet = <span class="hljs-function">...</span></code></pre>
```

The language argument is optional. If omitted, highlight.js will attempt to auto-detect the language.

**Markdown code fences** are also highlighted automatically at build time:

````md
```json
{ "name": "poops" }
```
````

Registered languages: `javascript`/`js`, `typescript`/`ts`, `css`, `scss`, `html`, `xml`, `json`, `bash`/`sh`, `shell`, `python`/`py`, `ruby`/`rb`, `php`, `java`, `c`, `cpp`, `csharp`/`cs`, `go`, `rust`/`rs`, `yaml`/`yml`, `markdown`/`md`, `sql`, `diff`.

#### Custom Filters

- `slugify` — slugifies a string. Usage: `{{ "My Awesome Title" | slugify }}` will output `my-awesome-title`

- `jsonify` — serializes a value to JSON. Usage: `{{ myObject | jsonify }}`

- `markdown` — renders a markdown string to HTML. Usage: `{{ "**bold**" | markdown }}`

- `date` — formats a date string. Uses [dayjs](https://day.js.org/) format tokens. Usage: `{{ "2024-01-15" | date("MMMM D, YYYY") }}` will output `January 15, 2024`. A default format can be set via the `timeDateFormat` config option.

- `concat` — returns a new array with the value appended (does not mutate the original):

```nunjucks
{% set items = ["a", "b"] %}
{% set more = items | concat("c") %}
{# more = ["a", "b", "c"], items unchanged #}
```

- `push` — appends a value to an array in place (mutates the original):

```nunjucks
{% set items = ["a", "b"] %}
{{ items | push("c") }}
{# items = ["a", "b", "c"] #}
```

- `svg` — reads an SVG file and injects it inline. The path is resolved relative to the project root. Returns empty string if the file doesn't exist or isn't an SVG:

```nunjucks
{{ 'src/icons/logo.svg' | svg }}
```

- `highlight` — syntax-highlights a code string at build time using highlight.js. Takes an optional language argument:

```nunjucks
{{ someCodeVariable | highlight('javascript') }}
```

If the language is omitted, highlight.js will auto-detect it. Returns a `<pre><code class="hljs">` block with highlighted markup.

- `srcset` — returns just the srcset attribute value:

```html
<img
  src="static/photo-640w.jpg"
  srcset="{{ 'static/photo.jpg' | srcset }}"
  sizes="100vw"
  alt="Hero"
/>
```

Returns: `static/photo-320w.webp 320w, static/photo-640w.webp 640w, static/photo-960w.webp 960w`

#### Search Index & Sitemap

Poops can automatically generate a JSON search index and/or an XML sitemap from your compiled pages. Both are generated in a single pass during the markup compilation phase.

To enable, add `searchIndex` and/or `sitemap` to your markup config:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "searchIndex": "search-index.json",
      "sitemap": "sitemap.xml"
    }
  }
}
```

The string shorthand sets the output filename with default options. For more control, use the object form:

```json
{
  "searchIndex": {
    "output": "search-index.json",
    "minWordLength": 3,
    "maxKeywords": 20,
    "globalFrequencyCeiling": 0.8,
    "stopWords": "path/to/custom-stop-words.json"
  },
  "sitemap": {
    "output": "sitemap.xml"
  }
}
```

**Search Index options:**

- `output` — output filename, written to the markup output directory
- `minWordLength` — minimum word length to consider as a keyword (default: `3`)
- `maxKeywords` — maximum keywords per page (default: `20`)
- `globalFrequencyCeiling` — drop words appearing in more than this fraction of all pages (default: `0.8`, meaning words found in 80%+ of pages are dropped as non-discriminating)
- `stopWords` — customise stop word filtering:
  - omit or `undefined` — uses the bundled English stop words
  - `false` — disables stop word filtering entirely
  - `["word1", "word2"]` — inline array of stop words
  - `"path/to/file.json"` — path to a JSON array file (relative to project root)

**Search Index output format:**

All front matter fields are passed through to the index automatically. Internal fields (`content`, `isIndex`, `layout`, `published`) are stripped. If a page defines `keywords` in its front matter, those are used as-is instead of auto-extracted ones.

```json
[
  {
    "title": "My Post",
    "date": "2024-01-15",
    "description": "A great post about things.",
    "collection": "blog",
    "tags": ["javascript", "bundler"],
    "url": "blog/my-post.html",
    "keywords": ["javascript", "bundler", "webpack", "esbuild"]
  }
]
```

**Sitemap** generates a standard `sitemap.xml` with `<loc>` and `<lastmod>` (from front matter `date`). If `site.url` is set in your markup config, it is prepended to all URLs. Collection index/pagination pages are included in the sitemap but excluded from the search index.

Pages with `published: false` in their front matter are excluded from both outputs.

### Copy

Configuration entry to copy files or directories - copy your static files like images and fonts, for instance, from `src` to `dist` directory. This feature was added to enable moving static files if you deploy GitHub pages via a GitHub action. If you don't want to use this feature, simply exclude the `copy` property from your config file.

Here is a sample copy configuration which will copy the `static` directory and it's contents to the `dist` directory:

```JSON
{
  "copy": {
    "in": "src/static",
    "out": "dist"
  }
}
```

You can specify a list of input paths and pass them to an output directory, for instance:

```JSON
{
  "copy": {
    "in": ["src/static/ogimage.jpg", "src/static/favicon.ico", "src/fonts"],
    "out": "dist"
  }
}
```

**💡 NOTE:** Copy property can also accept the list of objects containing `in` and `out` properties. For instance:

```JSON
{
  "copy": [
    {
      "in": ["src/static/ogimage.jpg", "src/static/favicon.ico", "src/fonts"],
      "out": "dist"
    },
    {
      "in": "images",
      "out": "dist/static"
    }
  ]
}
```

**💡 NOTE:** Copy can also accept **GLOB** and **EXTGLOB** patterns as input paths, except POSIX character classes (e.g. `[[:alpha:]]`):

```JSON
{
  "copy": {
    "in": [
      "images/**/awesome.{jpeg,jpg,png}",
      "notes/info[0-9].txt",
      "notes/doc?.txt",
      "notes/memo*.txt",
      "notes/log[!123a].txt",
      "assets/!(vendor)/*.js",
      "fonts/@(woff|woff2)/*.+(woff|woff2)",
      "docs/?(intro|overview).md"
    ],
    "out": "dist"
  }
}
```

### Banner (optional)

Here you can specify a banner that will be added to the top of the output files. It is templatable via mustache. The following variables are available from your project's `package.json`:

- `name`
- `version`
- `homepage`
- `license`
- `author`
- `description`

Here is a sample banner template.

```
/* {{ name }} v{{ version }} | {{ homepage }} | {{ license }} License */
```

You can always pass just a string, you don't have to template it.

If you don't want to add a banner, just remove the `banner` property from the config.

### Local Server (optional)

Sets up a local server for your project.

Server options:

- `port` - the port on which the server will run
- `base` - the base path of the server, where your HTML files are located

If you don't want to run a local server, just remove the `serve` property from the config.

### Live Reload (optional)

Sets up a livereload server for your project.

Live reload options:

- `port` - the port on which the livereload server will run
- `exclude` - an array of files and directories to exclude from livereload

`livereload` can only be `true`, which means that it will run on the default port (`35729`) or you can specify a port:

```json
{
  "livereload": {
    "port": whateverPortYouWant
  }
}
```

You can also exclude files and directories from livereload:

```json
{
  "livereload": {
    "exclude": ["some_directory/**/*", "some_other_directory/**/*"]
  }
}
```

In order for Livereload to work, you need to add the following script snippet to your HTML files in your development environment:

```html
<script>
  document.write(
    '<script src="http://' +
      (location.host || "localhost").split(":")[0] +
      ':35729/livereload.js?snipver=1"></' +
      "script>",
  );
</script>
```

Be mindful of the port, if you have specified a custom port, you need to change the port in the snippet as well.

You can also use a browser extension for livereload, for instance here is one for [Chrome](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei?hl=en). You can find also extensions for Firefox and Opera, but NOT for Safari.

If you don't want to run livereload, just remove the `livereload` property from the config, or set it to false.

### Watch (optional)

Sets up a watcher for your project which will rebuild your files on change.

`watch` property accepts an array of paths to watch for changes. If you want to watch for changes in the `src` directory, just add it to the `watch` array:

```json
{
  "watch": ["src"]
}
```

If you don't want to watch for file changes, just remove the `watch` property from the config.

### Include Paths (optional)

This property is used to specify paths that you want to resolve your imports from. Like `node_modules`. You don't need to specify the `includePaths`, `node_modules` are included by default. But if you do specify `includePaths`, you need to include `node_modules` as well, since this change will override the default behavior.

Same as `watch` property, `includePaths` accepts an array of paths to include. If you want to include `lib` directory for instance, just add it to the `includePaths` array:

```json
{
  "includePaths": ["node_modules", "lib"]
}
```

## Todo

- [ ] Run esbuild for each input path individually if there are multiple input paths
- [ ] Styles `in` should be able to support array of inputs like we have it on scripts
- [ ] Build a cli config creation helper tool. If the user doesn't have a config file, we can ask them a few questions and create a config file for them. Create Yeoman generator for poops projects.
- [x] Add nunjucks static templating
  - [x] Refactor nunjucks implementation
  - [x] Complete documentation for nunjucks
  - [x] Add markdown support
  - [x] Front Matter support
  - [x] Future implementation: posts and custom collections, so we can have a real static site generator
  - [x] Collection pagination system
  - [x] Post published toggle
  - [x] RSS and ATOM generation for collections
  - [x] Support for images and creating srcsets

## Why?

Why doesn't anyone maintain GULP anymore? Why does Parcel hate config files? Why are Rollup and Webpack so complex to setup for simple tasks? Vite???? What's going on?

I'm tired... Tired of bullshit... I just want to bundle my scss/sass and/or my js/ts to css and iife/esm js, by providing input and output paths for both/one. And to be able to have minimal easily maintainable dependencies. I don't need plugins, I'll add the features manually for the practice I use. That's it. The f\*\*king end.

To better illustrate it, here is a sample diff of Poops replacing Rollup:

![Screenshot 2023-07-03 at 16 34 32](https://github.com/stamat/poops/assets/1429864/6a8598e7-d188-4d9f-ae3c-5bfa3bbf78e9)

This is a bundler written by me for myself and those like me. Hopefully it's helpful to you too.

Love :heart: and peace :v:.
