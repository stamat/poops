# Changelog

All notable changes to Poops are recorded here. Releases before 1.9.0 are on the
[changelog site](https://stamat.info/poops/changelog/), where every entry is a
post that demonstrates the feature it describes.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
Poops uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Contributing an entry

Write your change under `## [Unreleased]`, using `### Added`, `### Changed`,
`### Fixed`, `### Deprecated`, `### Removed` or `### Security`. Give the heading
a short title after an em dash and open with one paragraph explaining what was
wrong before — those two become the title and description of the changelog post:

```markdown
## [Unreleased] — fence info strings carry through

A fence could say more than its language, but only the language survived to the
HTML.

### Added

- **The rest of the info string becomes classes and data attributes.** ...
```

Write plain Markdown — template tags like `{{ page.title }}` are fenced for you
when the post is generated. Describe what changed for someone using Poops, not
which functions moved.

On `script/publish`, `script/changelog` cuts this section into a released entry
and writes `example/src/markup/changelog/v<version>.md` from it, in the same
commit as the version bump. The entry also becomes the body of the GitHub
release, verbatim — no notes to paste in by hand. **A post you wrote by hand at that path is never
overwritten** — that is the escape hatch for releases whose post is a live demo,
which is most of them here. Write the post first, then the entry.

## [Unreleased]

## [2.2.0] - 2026-08-07 — a dependency vouches for a config key, the heading anchor leaves the tab order

A companion's block passed in silence only when you depended on the companion by
name, which a package that arrives through another one never is. Separately, the
permalink anchor beside every heading was hidden from screen readers and still
reachable by keyboard — a tab stop with nothing to announce, once per heading,
on every page Poops has built.

### Added

- **A direct dependency can vouch for a companion's config key.** A `septic` block
  passed in silence only when `septic` itself sat in your package.json — but laxative
  brings septic, so a laxative app declares `laxative` and the warning fired on every
  build. A dependency now vouches through its own manifest,
  `"poops": { "companionKeys": ["septic"] }`, read one directory deep and never loaded.
  Nothing declared and nothing vouched still warns, which is what catches the typo.

### Fixed

- **The heading permalink is no longer a tab stop on nothing.** Every heading gets an
  anchor, and it carried `aria-hidden="true"` while staying focusable — so a keyboard
  reached it, and a screen reader had nothing to announce when it landed. That is a link
  with no accessible name in the tab order, once per heading, on every page Poops has ever
  built. It also carried `aria-label="Permalink"`, which `aria-hidden` had already made
  unreadable to anyone.

  The anchor now says the same thing three ways instead of three different things: it is
  decoration, so it takes `tabindex="-1"` beside the `aria-hidden` it always had, and the
  dead `aria-label` is gone. The heading beside it is already the name of the place.
  **DOM change:** `<a class="heading-anchor" href="#id" tabindex="-1" aria-hidden="true">`,
  where it was `aria-label="Permalink" aria-hidden="true"`. Nothing changes for a mouse —
  the "#" a theme reveals through `.heading-anchor::before` still clicks — and a theme
  styling `[aria-label="Permalink"]` rather than the class is the one selector this breaks.

- **Config Poops has always accepted is finally written down.** `exec` had no section in
  the README at all, only two passing mentions of a key nothing introduced. `watch: true`,
  the per-entry `nodePaths`, `markup.options.autoescape` and `dateFormat`, the `feed`'s
  `content`, the `toc` filter and the banner's `{{ year }}` were each real, tested and
  undocumented — some in the README, some on the docs site, `nodePaths` and `{{ year }}`
  in neither. Two engine-contract listings also still advertised `fileExtension` and
  `renderString`, which the pipeline stopped calling, while omitting the `invalidate` /
  `pagesDependingOn` pair that incremental rebuilds actually run on. Nothing changed in the
  code; the pages now say what it does. A new test walks every link in the README and the
  documentation site, so the eleven dead ones found writing this are the last of them.

## [2.1.0] - 2026-08-05 — a schema for poops.json, llms.txt on its own

The config file now tells your editor what belongs in it — and tells Poops,
which no longer lets a key misspelt inside a block pass in silence. It also
stops calling a companion package's block a mistake. Separately, `llms` was the one index
feature that could not turn itself on, and the corpus it writes carried the
machinery of the pages it was made from.

### Added

- **A JSON Schema for `poops.json`, so the editor catches a typo you would
  otherwise find in the output.** A top-level `"stlyes"` was warned about and
  ignored, and a mistyped script option reaches esbuild, which rejects it — but
  `"minfiy"` in a style's options is read by nothing and warned about by nobody.
  The build stays green and the `.min.css` is never written.

  Poops now ships `schema/poops.schema.json`, covering every key, with the
  documentation for each one inline. Point `$schema` at it and the editor
  completes and validates as you type:

  ```json
  {
    "$schema": "./node_modules/poops/schema/poops.schema.json"
  }
  ```

  The same file is published at
  [`https://stamat.info/poops/poops.schema.json`](https://stamat.info/poops/poops.schema.json)
  for a project that has not installed Poops yet, and can be attached by
  filename from VS Code's `json.schemas` setting instead of by editing the
  config. The `$schema` key is inert to Poops — it is recognised and otherwise
  ignored, and nothing was added to what Poops installs into your project.

  The schema is hand-written, so Poops' own test suite holds it to the code: it
  is validated against the draft-07 meta-schema, and `poops.json` plus every
  complete config example in the README and on the documentation site is
  validated against it, so an example that stops being valid config now fails
  the build.

- **A key misspelt inside a block is now named too.** The unknown-key warning
  stopped at the top level: `"stlyes"` was caught, `"inn"` in a styles entry was
  not. That entry compiled nothing, `poops -b` exited 0, and the file that never
  appeared was the only sign. Poops now checks every block it owns against the
  schema it ships, at startup:

  ```
  [info][warn] Unknown key "inn" in styles[0] — ignored. Valid: in, out, options
  ```

  Key names only, and only where Poops owns them: `images` belongs to
  poops-images, `site` is yours to name, and a companion's top-level block is
  left alone — an unrecognised key in any of those passes without comment.
  Types are not checked, so `"minify": "yes"` still reaches the compiler and
  fails there. `exec` keeps its own warning, which says the more useful thing —
  that the stage never runs. The schema read is the copy inside
  `node_modules/poops`, so where `$schema` points changes nothing.

  The walk is [unknown-keys](https://github.com/stamat/unknown-keys), a new
  dependency and the only one this release adds — zero dependencies of its own,
  written for this and published separately because poops-images and septic read
  the same file and want the same warning.

### Changed

- **A top-level key naming a package you depend on is no longer called
  unknown.** `poops.json` is shared — [septic](https://github.com/stamat/septic)
  reads a `septic` block out of the same file — but every build printed
  `Unknown config key "septic" — ignored`, a warning about something working
  exactly as designed. The name is now checked against your `dependencies`,
  `devDependencies`, `peerDependencies` and `optionalDependencies` first, and a
  match passes in silence. Declaring the package is enough; Poops still never
  loads it or reads its block. Nothing by that name declared, and the warning
  is unchanged — which is what still catches `"stlyes"`.

  Your editor cannot see `node_modules`, so the schema cannot make that call: it
  allows an object under any name it does not know and rejects everything else,
  meaning `"stlyes": [ … ]` is flagged there but `"srve": { … }` is not. The CLI
  catches what the editor lets through.

### Fixed

- **`llms` alone now generates its files.** Page entries were collected only
  when `searchIndex`, `sitemap`, `nav` or `feed` was configured, so a markup
  config whose only index feature was `llms` compiled the site and wrote
  nothing — no warning, no output. Pairing it with a sitemap was the
  workaround; there is nothing to pair it with now.

- **`llms-full.txt` no longer carries a page's machinery.** The corpus is built
  from the Markdown source, which is read before the template engine runs, so it
  held whatever the source held: template comments, tags and output expressions,
  and every inline `<style>` and `<script>` on the page. A page that wraps its
  body in a `{% set body %}…{% endset %}` capture and styles itself in a
  `<style>` block could hand an LLM more plumbing than prose. All of it is
  stripped now, and the prose a capture wrapped stays. Fenced blocks, inline
  code spans and `{% raw %}` bodies are left alone — a sample documenting
  template syntax is content. A feed's article HTML is built from the same
  stripped source.

## [2.0.0] - 2026-07-31 — the dev loop, modernized

Poops 2.0 has no new features. It is the release where the core loop — watch,
build, reload — stops carrying old dependencies and old spellings, and where the
compat shims that survived the whole 1.x line finally go.

### Changed

- **Poops now requires Node.js 22 or newer.** Node 20 reached end of life in
  April 2026, and the dependencies the dev loop is built on — the file watcher,
  esbuild — assume a modern runtime anyway. CI tests on Node 22 and 24, on both
  Ubuntu and Windows.

- **Live reload is now served by Poops itself, on the server port.** The
  `livereload` package is gone, and with it a second port, an old websocket
  stack, and the snippet you had to paste into your templates.

  `"livereload": true` alongside `"serve"` is all it takes. Poops answers
  `/__poops_reload` as a server-sent events stream and appends a small client
  script to each HTML page it serves — appends it to the *response*, so nothing
  lands in your build output. Behaviour is unchanged otherwise: one reload per
  save once the build settles, CSS-only builds swap stylesheets in place
  instead of reloading, and the browser reconnects by itself after a restart.

  Migrating: delete the `livereload.js` snippet from your templates (a leftover
  one is harmless — it will 404 quietly), and drop `livereload.port`,
  `livereload.exclude`, `livereload.extraExts` and `livereload.exts` from your
  config. The last three had already stopped doing anything when the reload
  server stopped watching files in 1.5.1.

- **The file watcher moved from chokidar 3 to chokidar 5.** Two majors of
  watcher fixes, and one fewer legacy dependency tree under `node_modules`.
  Nothing in your config changes: `watch` has always been a list of directories,
  never globs, so chokidar 4 dropping glob support costs nothing here. Watch
  mode behaves as before — one rebuild per save, CSS still hot-swaps, deletions
  still remove their output.

- **esbuild moved from 0.25 to 0.28, and the default `target` from `es2019` to
  `es2020`.** esbuild is pre-1.0, so its minor bumps shift output by design;
  absorbing that is what a major of ours is for. Expect small differences in
  your bundles — the CommonJS interop helper is more careful around a throwing
  module, and `Symbol.for` calls are annotated as side-effect free, which makes
  minified output slightly *smaller*.

  The new default target is the visible half: optional chaining (`?.`) and
  nullish coalescing (`??`) are ES2020, and compiling them down for browsers
  that have shipped them since 2020 only made bundles bigger. Entries that set
  their own `target` are untouched.

- **`timeDateFormat` is now `dateFormat`.** It sets the default format for the
  `date` filter; the old name said the same thing twice. Deprecated and still
  read through 2.x, gone in 3.0.

  Engines see the rename too: `registerFilters({ timeDateFormat, markupOut })`
  is now `registerFilters({ dateFormat, markupOut })`. This is a hard rename —
  it lands before the engine interface becomes public API in this same release,
  so a custom engine must update its parameter name for 2.0.

- **`output` is now `out` in the markup sub-features.** `llms`, `nav`, `feed`,
  `searchIndex`, `sitemap` and `robots` name their output file with `out`, the
  same word every entry in the config already uses:

  ```json
  { "nav": { "out": "nav.json", "root": "docs" } }
  ```

  `output` is **deprecated but still honoured** through 2.x, warning once per
  feature, and stops working in 3.0. The string shorthand (`"nav": "nav.json"`)
  is unaffected.

- **Markup settings belong under `markup.options`.** `markup` now has the shape
  every other entry has — `in`, `out`, and everything else in `options`:

  ```json
  {
    "markup": {
      "in": "src/markup",
      "out": "dist",
      "options": {
        "engine": "nunjucks",
        "site": { "title": "My Site" },
        "searchIndex": "search-index.json"
      }
    }
  }
  ```

  1.x read `engine`, `site`, `data`, `includePaths`, `timeDateFormat`,
  `collections`, `searchIndex`, `sitemap`, `llms`, `robots`, `feed`, `nav`,
  `baseURL` and `autoescape` at the `markup.` level as well. That placement is
  **deprecated but still honoured** through 2.x — each stray key logs a warning
  naming its new home — and stops working in 3.0. Where both are set, `options`
  wins.

### Added

- **The markup engine interface is public API as of 2.0.** `markup.options.engine`
  has always accepted any importable module, and
  [poops-shopify](https://github.com/stamat/poops-shopify) ships a production
  engine against it — but nothing said the interface was stable, so a rename in
  a patch release could have broken it silently. It is documented in
  [the engine API reference](docs/engine-api), semver applies to it from here on,
  and a contract test asserts both builtin engines still expose the shape — a
  failing test is a breaking change caught before it ships.

- **`serve.base` defaults to the markup `out` directory.** Nearly every config
  set it to the path it had just built into. Set it only when the server should
  serve somewhere else; an explicit value still wins, and a project with no
  `markup` still serves the working directory.

### Removed

- **The `ssg` config key.** It has been an alias for `reactor` since the rename,
  and it was the last compatibility shim in the codebase. A config still using
  it now gets told what to call it instead:

  ```
  [info] Config key "ssg" is renamed to "reactor" in 2.0 — ignored.
  ```

### Internal

- **Dependency bumps.** `book-of-spells` 1.3 → 1.4 and a `postcss` patch, both
  routine. Dev-only: `neostandard` 0.12 → 0.13, and `sulphuris` 2 → 4 for the
  example site's styles. ESLint stays on 9 — neostandard 0.13 still declares a
  peer of `eslint@^9`, so 10 has to wait for it.

### Fixed

- **"Edit this page on GitHub" links work for collection items on Windows.** A
  collection item's `filePath` kept native separators while a regular page's was
  posix, so on Windows the link for a post came out as
  `…/edit/main/src/posts\hello.md`. Both are posix now.

- **The image cache is read correctly across platforms.** Its lookups all key on
  posix paths, so a cache written on Windows — committed next to the images it
  describes, or built in CI — matched nothing and galleries came up empty. Keys
  and variant paths are normalized on read. The output-directory containment
  check also no longer accepts a sibling directory whose name merely starts with
  the output dir's (`dist-old` for `dist`).

- **A style edit hot-swaps the stylesheet the page actually links.** With
  `minify` on, the reload chain was told about `site.css` while the page linked
  `site.min.css` — no stylesheet matched, so every style edit reloaded the whole
  page instead of swapping the CSS. Both spellings are now reported (and with
  `justMinified`, only the minified one, since the other is deleted).

## [1.9.8] - 2026-07-31 — fence info strings carry through

A fence could say more than its language, but only the language survived to the HTML — anything marking a fence for a later stage had to be an HTML comment next to it in the Markdown. The rest of the info string now lands on the code element as classes and data attributes, and all six places that render a code block finally agree on what one looks like.

### Added

- **The rest of a fence's info string becomes classes and `data-` attributes.**
  1.9.7 stopped meta words leaking into the language class, which fixed the
  highlighting bug but threw the words away. So a fence could be labelled and
  nothing downstream could see the label — the marker for "this block is a live
  demo" had to live beside the fence as an HTML comment, one thing to keep in
  sync with another.

  Everything after the language now rides along: a bare word becomes a class, a
  `key=value` token becomes a data attribute.

  ````markdown
  ```html preview tab=options widths=375,768
  <my-element></my-element>
  ```
  ````

  ```html
  <pre><code class="hljs language-html preview" data-tab="options" data-widths="375,768">…</code></pre>
  ```

  A post-`markup` `exec` script then matches `code.preview` and reads the
  settings off the element, with nothing in the Markdown but the fence itself.
  Values are single tokens — no quotes, no spaces — which keeps the parser a
  `split`; anything needing a sentence belongs in the prose around the fence,
  not in its opening line.

  A bare word is a class rather than a valueless attribute, since a class is
  what the consumer selects on. When you do want the attribute — a flag read
  with `hasAttribute` instead of off `classList` — write the key with nothing
  after the `=`:

  ````markdown
  ```html preview expanded=
  <my-element></my-element>
  ```
  ````

  ```html
  <pre><code class="hljs language-html preview" data-expanded="">…</code></pre>
  ```

  Backwards compatible in the strict sense: a single-token info string renders
  exactly as before, which is every fence on every site today. Both the
  `{% highlight %}` tag and the `highlight` filter take the
  same info string.

### Fixed

- **All six renderers agree on what a code block is.** The same three lines were
  copy-pasted across the Markdown renderer, the standalone highlight renderer,
  and the filter and tag in each engine — and 1.9.7 only fixed two of them. The
  engine copies still interpolated the whole info string into the class
  attribute, so they disagreed with the Markdown renderer about a fence's output
  and were right about `language-html preview` purely by accident. One
  `codeBlock` helper now emits every code block, so there is one place left to
  get wrong.

## [1.9.7] - 2026-07-29 — site-wide JSON-LD defaults

The jsonld escape hatch was per page only, so a site whose pages are all one type — a docs site is TechArticle, not WebPage — had to repeat the same front-matter block in every file, and a file that got missed silently shipped the wrong type. A jsonld object in your site data now sets the default for every page, with page front matter still winning.

### Added

- **`site.jsonld` sets a JSON-LD default for the whole site.** The `jsonld`
  filter picks `BlogPosting` for a dated page and `WebPage` for everything else,
  and a `jsonld` object in front matter overrode any of it. That escape hatch was
  per page, which is the wrong shape when the whole site is one type: a docs site
  is `TechArticle`, a knowledge base is `FAQPage`, a product catalogue is
  `Product`. The only way to say so was the same four lines of front matter in
  every file — and the failure mode is quiet, since a page that misses them still
  emits valid JSON-LD, just the generic type.

  The same object now works in your `site` data:

  ```json
  {
    "markup": {
      "site": {
        "jsonld": { "@type": "TechArticle" }
      }
    }
  }
  ```

  Every page renders as `TechArticle` — no front matter, nothing to forget. It
  isn't limited to `@type`; any key you would have set per page works site-wide,
  which is where the fields that genuinely don't vary belong:

  ```json
  "jsonld": {
    "@type": "TechArticle",
    "license": "https://opensource.org/licenses/MIT",
    "isAccessibleForFree": true
  }
  ```

  Precedence is defaults → `site.jsonld` → `page.jsonld`, so a single page still
  opts out of the site-wide type while keeping the rest of it — a `FAQPage`
  inside a `TechArticle` site keeps the `license` and only replaces `@type`:

  ```yaml
  ---
  title: Frequently asked questions
  jsonld:
    "@type": FAQPage
  ---
  ```

  Two things it deliberately doesn't do. A site-wide `@type` beats the
  auto-detected `BlogPosting` as well — it's a default you set, not one poops
  guessed — so on a site that mixes docs with a blog, set the type per page
  rather than site-wide, or the posts stop being articles. And it merges into
  the page's own block only: the `WebSite` block on the homepage and the
  auto-appended `BreadcrumbList` on nested pages are structural, and a site-wide
  `@type` has no business rewriting them.

  Same shallow merge as the front-matter object, for the same reason — nested
  schema is rare, and the escape hatch is meant for whole-key replacement.

## [1.9.6] - 2026-07-29 — output path templating for styles and scripts

The index.* rename only saved entry points literally named index — every other glob match still took its own basename, so src/elements/*/theme.scss wrote theme.css once per component and the last one won. A styles or scripts out can now be a template, one token for the match's directory and one for its basename, naming one output per match. And live CSS reload no longer guesses those paths, it reads what the compiler actually wrote.

### Added

- **`out` can be a template, for styles and scripts alike.** `v1.9.5` named a
  glob-matched `index.*` after its directory, which fixed the case a component
  library actually hits. It did nothing for anything else: point a glob at
  `src/elements/*/theme.scss` and every match still falls back to its own
  basename, so the components overwrite each other in the output directory and
  the last one to build wins. There was no way to say what you wanted the files
  called.

  Now there is. An `out` carrying `{{dir}}` or
  `{{name}}` resolves per entry point instead of naming one
  shared destination:

  ```json
  {
    "styles":  { "in": "src/elements/*/theme.scss", "out": "dist/css/{{dir}}-{{name}}.css" },
    "scripts": { "in": "src/elements/*/widget.ts",  "out": "dist/js/{{dir}}-{{name}}.js" }
  }
  ```

  ```
  src/elements/accordion/theme.scss  →  dist/css/accordion-theme.css
  src/elements/tabs/theme.scss       →  dist/css/tabs-theme.css
  src/elements/accordion/widget.ts   →  dist/js/accordion-widget.js
  src/elements/tabs/widget.ts        →  dist/js/tabs-widget.js
  ```

  `{{dir}}` is the match's directory relative to the glob's
  **static prefix** — the same name an `index.*` entry gets, so the two rules
  agree on what a component is called, and widening the glob keeps the segments
  it no longer pins down. `{{name}}` is the basename
  without its extension. Whitespace inside the braces is fine
  (`{{ dir }}`), matching the `banner` templates.

  Tokens work in directory segments too, so the flat layout isn't the only one
  available:

  ```json
  { "in": "src/elements/*/theme.scss", "out": "dist/css/{{dir}}/theme.css" }
  ```

  A literal entry fills `{{dir}}` with its own directory
  name, which keeps mixed arrays of globs and plain paths working:

  ```
  "out": "dist/css/{{dir}}.css"

  src/scss/main.scss                 →  dist/css/scss.css
  src/elements/accordion/index.scss  →  dist/css/accordion.css
  ```

  For scripts the template's extension is honoured as well, which is the cheap
  way to ship one format per entry point rather than one bundle per format:

  ```json
  { "in": "src/elements/*/index.ts", "out": "dist/esm/{{dir}}.mjs",
    "options": { "format": "esm" } }
  ```

  A template wins over the `index.*` rename — you named these outputs, and
  renaming them behind your back is the thing globs were already doing wrong.
  It's also exempt from the "more than one entry file needs a directory `out`"
  guard, since a template already resolves to a different file per entry rather
  than to one file everything overwrites. What it does not do is invent
  uniqueness: `"out": "dist/{{name}}.css"` across component
  directories collides exactly like a plain directory `out` would, and its
  scripts equivalent fails the build outright with esbuild's *"Two output files
  share the same path"*. That's what `{{dir}}` is there
  for.

### Fixed

- **Live CSS reload no longer guesses the output path.** The watch chain fed
  livereload a path derived from the config — a directory `out` joined with the
  basename of `in`. For a single named entry point that guess was right. For a
  glob it was the pattern's own basename, so `src/elements/*/index.scss`
  reported `dist/css/index.css`, a file that was never written; a templated
  `out` reported the template verbatim, braces and all. The livereload client
  looks for a loaded stylesheet matching the path it is handed and, finding
  none, falls back to reloading the whole page — so editing a component's Sass
  flashed a full reload instead of swapping the stylesheet in place, and any
  scroll position or open state went with it.

  The styles compiler now records the files it wrote and the watch chain
  reloads exactly those. One entry, one glob or twenty templated outputs, the
  reported paths are the ones on disk, because nothing derives them a second
  time.

- **The watcher's output zones understand templates.** A compiler writing into
  a watched directory must not retrigger itself, which the watcher prevents by
  zoning each task's `out`. A templated `out` is only a fixed path up to its
  first token, so `dist/{{dir}}/theme.css` zoned a directory literally named
  `{{dir}}`, protecting nothing. Zones are now taken from the static prefix.

## [1.9.5] - 2026-07-29 — index entries take their directory's name

Building a library of components, a directory per component means every entry point is called index — and every one of them compiled to index.css, or nested a level deep under esbuild's outbase. A glob-matched index.* is now named after the directory that holds it, so one glob turns a tree of component directories into a flat set of named bundles. Brace patterns like index.{js,ts} count as globs too.

### Added

- **A glob-matched `index.*` is named after its directory.** This one is for
  building libraries of components. One directory per component is the obvious
  way to lay a library out — the accordion's markup, styles and script live
  together, and each one is called `index`. Point a glob at them and the naming
  falls apart, differently for each pipeline. Styles compiled every match to
  `<out>/index.css`, so the last directory to build won and the rest were
  overwritten in silence. Scripts fared better but not well: esbuild nests entry
  points from different directories under their common ancestor, so you got
  `dist/accordion/index.js` where you wanted `dist/accordion.js`.

  ```json
  {
    "scripts": { "in": "src/elements/*/index.{js,mjs,cjs,jsx,ts,tsx}", "out": "dist/js/" },
    "styles":  { "in": "src/elements/*/index.{scss,sass,css}",         "out": "dist/css/" }
  }
  ```

  ```
  src/elements/accordion/index.scss  →  dist/css/accordion.css
  src/elements/accordion/index.ts    →  dist/js/accordion.js
  src/elements/tabs/index.scss       →  dist/css/tabs.css
  src/elements/tabs/index.ts         →  dist/js/tabs.js
  ```

  Two globs, and the whole library builds to a flat set of bundles named after
  the components — add a directory, get a bundle, no config change.

  The rename only applies to entries a glob matched. A literal
  `"in": "src/index.js"` still writes `dist/index.js`, and
  `"in": "src/scss/index.scss"` still writes `dist/index.css` — you named that
  entry point yourself, and moving it to `src.js` or `scss.css` because of a
  rule about globs would be a rename you never asked for. Same for an explicit
  `out` file path: that always wins.

  The name is placed relative to the glob's **static prefix** — everything
  before its first magic segment — which is what keeps the flat case flat
  without making same-named components collide. `src/elements/*/index.scss`
  has the prefix `src/elements`, shared by every match, so nothing is left to
  nest under. Widen the glob and the part it no longer pins down is kept:

  ```
  "src/*/accordion/index.scss"

  src/blocks/accordion/index.scss    →  dist/css/blocks/accordion.css
  src/elements/accordion/index.scss  →  dist/css/elements/accordion.css
  ```

  Two `accordion` directories, two stylesheets, no overwrite — and no config
  to keep in sync, because the prefix is read off the pattern rather than off
  whatever happened to match. Add or remove a component and the layout of the
  rest doesn't move.

- **Brace patterns count as globs.** `hasMagic` doesn't treat braces as magic by
  default, so a pattern with alternates but no wildcard —
  `src/elements/accordion/index.{scss,sass,css}` — was read as a literal file
  path, and failed with `Entry does not exist:` naming a file that was never
  going to exist. It now resolves as the glob it obviously is, which is what
  makes "whichever extension this component happens to use" expressible for a
  single component and not only across a `*`.

  The watcher learned the same thing. A brace pattern in a `copy`, `images` or
  `markup` `in` is now matched as a glob when deciding whether a changed file
  belongs to that task, instead of falling through to a path-segment compare
  that could never match it.

## [1.9.4] - 2026-07-28 — one build, one copy

A build that writes several files into a watched directory fired the same rebuild branch once per file — five copy passes and a stack of style recompiles for a single save. Watcher events are now coalesced, so a burst folds into one run.

### Fixed

- **Watcher events are coalesced — a multi-file burst triggers one rebuild, not
  one per file.** Chokidar fires one event per written file, but a single build
  rarely writes a single file. A styles entry with sourcemaps and minify on
  writes three — `.css`, `.css.map`, `.min.css` — and a post-compile `exec`
  step that rewrites the output makes it four. If those land in a directory
  another instance watches (a library's `dist/` inside a docs site's `copy`
  source, the setup `--quiet` was added for), every one of those events ran
  the full branch: five `Copied N paths` passes and three or four style
  recompiles per save, all doing the same work on the same files.

  The copy and style branches now collect events over a trailing 300ms window
  — sized to outlive the 150ms `awaitWriteFinish` settle between files of one
  burst — and run once when the burst goes quiet. The window keeps the paths,
  so the per-file behavior survives: a css-only burst still hot-swaps each
  stylesheet in place, anything else still escalates to one full reload.

  Browser refreshes were already folded this way — `reload()` has debounced
  since the livereload server stopped fs-watching. Now the work feeding the
  refresh is folded too. One save, one compile, one copy, one refresh.

## [1.9.3] - 2026-07-28 — a --quiet flag for parallel runs

The new --quiet / -q flag hides the header banner and the Local server / Network / LiveReload lines, so several Poops instances running side by side don't bury the compile logs under three copies of the same address block.

### Added

- **`--quiet` / `-q` hides the banner.** Running one Poops instance, the header
  and the address block are the useful part of startup. Running several at once
  — a library build in the repo root and its docs site under `site/`, each with
  its own `poops.json` — they stop being useful: three headers, three terminal
  bells, and two `Local server` blocks whose ports you already know, scrolling
  past before the first compile line lands.

  ```bash
  poops -q & poops -q -c site/poops.json
  ```

  What `-q` removes is exactly the startup furniture:

  ```
  💩 Poops — v1.9.3         ← header, and its terminal bell
  -----------------
  🏠 Local server: …        ← the address block
  🛜  Network     : …
  🔃 LiveReload  : …
  ```

  Everything else prints as before — `[style] Compiled:`, `[markup] Compiled:`,
  warnings, errors, the non-zero exit on a failed build. The flag is deliberately
  not a log level: in a parallel run the compile lines are the one thing you're
  watching, and the tags already tell you which stage spoke.

  It composes with the other flags, so it fits a CI build the same way it fits a
  split terminal:

  ```bash
  poops --build --quiet --base-url /blog
  ```

  Ports are still resolved and still auto-incremented when one is taken — `-q`
  only stops them being announced. If you need to see which port an instance
  landed on, drop the flag for that one instance and keep it on the rest.

### Fixed

- **`justMinified` no longer throws `ENOENT` on watch rebuilds.** The
  post-minify step always deleted the unminified output, but watch rebuilds
  hand the compiled code to the minifier in memory — the file was never on
  disk, and every rebuild of a `justMinified` entry printed an `unlink`
  ENOENT stack trace. Harmless but loud. The delete now only runs when the
  file actually exists.

## [1.9.2] - 2026-07-28 — extensionless URLs, like GitHub Pages

The dev server now resolves /a/b to a/b.html, so links written without the extension stop 404ing locally while working fine in production. The 404 page also loads its own styles at any depth, and serve.base "/" no longer 404s every request.

### Fixed

- **The dev server resolves extensionless URLs.** GitHub Pages serves `/a/b`
  from `a/b.html` without touching the URL. The local server didn't, so a link
  written as `/changelog/v1.9.1` worked in production and 404'd on
  `localhost:4040` — the one place you'd have caught it. Both agree now:

  ```
  /a/b  →  a/b.html          200, URL stays /a/b
  /a/b  →  a/b/index.html    301 to /a/b/, then the index
  ```

  The directory redirect was already there; the file fallback is the new part,
  and it only fires when neither a file nor a directory matches. Relative
  assets on those pages need nothing special — an extensionless URL sits at
  the same depth as the file behind it, so `../css/styles.min.css` resolves
  the same for `/changelog/v1.9.1` and `/changelog/v1.9.1.html`.

- **`404.html` loads its assets at any depth.** The 404 page is the one file
  served from a path it doesn't live at: it sits at your site root but answers
  for `/a/b/c/anything`. Its relative asset paths — `./css/styles.min.css` —
  then resolved against `/a/b/c/`, so a miss at the root rendered fine and a
  miss two levels down rendered unstyled. The server now pins them:

  ```html
  <head>
    <base href="/" />
    <meta charset="utf-8" />
  </head>
  ```

  Injected only when the page doesn't already declare its own `<base>`, and
  only in the response — your built `404.html` is untouched on disk, which
  matters when you publish under a project path like `/poops/`.

- **`serve.base: "/"` no longer 404s the whole site.** The server keeps every
  request inside its base directory by resolving the path and checking it
  still starts with that base. A base of `/` joins to `<cwd>/` — with the
  trailing separator — so the check compared against `<cwd>//` and nothing
  ever matched. Every URL, including `/`, came back 404. The base is now
  normalized before anything is joined to it, so a trailing separator means
  what you'd expect. Traversal attempts are still rejected the same way.

## [1.9.1] - 2026-07-27 — load paths stop eating your pages

A sass load path with a slash in it silently produced a zero-page markup build. Fixed. The example docs also moved onto the poops-docs-theme package, the first real consumer of v1.9.0's package templates.

### Fixed

- **`includePaths` no longer breaks the markup glob.** Top-level `includePaths`
  is a sass/esbuild load path, but it was also folded into the exclude list the
  markup compiler globs with — and that list fills a single extglob segment:

  ```
  !(node_modules|.git|.svn|.hg|_*)/**/*.+(md|html)
  ```

  Any entry with a separator in it made the whole pattern match nothing. A site
  that legitimately needs `"includePaths": ["../node_modules"]` — node_modules
  at the repo root, docs built from a subdirectory — compiled zero pages, exited
  0, and said so only as `Compiled: 0 file`. Entries with a separator are now
  filtered out of the excludes; bare directory names still exclude as before.

### Changed

- **The example docs consume [`poops-docs-theme`](https://www.npmjs.com/package/poops-docs-theme)
  instead of local copies.** The docs layout, nav partial, stylesheet, and
  script are now an npm dependency — the first real user of the package
  templates added in [v1.9.0](/changelog/v1.9.0). Front matter points at the
  package, and the theme's sources compile straight out of `node_modules`:

  ```json
  {
    "scripts": [
      {
        "in": "node_modules/poops-docs-theme/src/docs.ts",
        "out": "example/dist/js/docs.js"
      }
    ],
    "styles": [
      {
        "in": "node_modules/poops-docs-theme/scss/docs.scss",
        "out": "example/dist/css/docs.css"
      }
    ]
  }
  ```

  ```yaml
  ---
  layout: poops-docs-theme/docs
  ---
  ```

  Four files left the repo and nothing about the docs changed on screen — which
  was the point.

## [1.9.0] - 2026-07-27 — templates from npm packages

Layouts and partials can now live in an installed npm package and resolve by package name — so a shared theme ships as a dependency instead of copied files. Works in both Nunjucks and Liquid.

### Added

- **Package templates resolve from `node_modules`.** A layout or partial can now
  live in an installed npm package and be referenced by package name, so a
  shared theme ships as a dependency instead of files copied into every project.
  Anything with a `/` is resolved from the consumer's `node_modules`; a bare
  name (no `/`) stays project-only, so the common path never touches the
  resolver.

  ```nunjucks
  {% extends "my-theme/layout.html" %}
  {% block content %}
    <h1>{{ page.title }}</h1>
  {% endblock %}
  ```

  Or from front matter, so the page carries no template syntax at all:

  ```yaml
  ---
  layout: my-theme/layout
  ---
  ```

  - **Nunjucks and Liquid both.** The Nunjucks loader falls back to
    `require.resolve` for `pkg/template.html`; the Liquid engine adds every
    ancestor `node_modules` on the path to its include roots — so hoisted,
    scoped, and pnpm installs all resolve, and liquidjs's containment guard
    stays intact.
  - **Project templates always win.** Package roots are appended last, so a
    same-named template in your own project shadows the package one.
  - **Bundled filters stay global.** `toc`, `breadcrumb`, `og`, `canonical`, …
    are engine-global, so package templates use them with no extra wiring.

  A theme package must not restrict subpaths with `exports` (or must map its
  templates explicitly, e.g. `"exports": { "./*": "./*" }`), and should
  reference its own partials relatively — `{% import "./nav.html" as nav %}`,
  not the bare name. See [Templating HTML → Templates from an npm package](/docs/quick-start/templating-html/).
