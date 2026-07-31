# Poops — agent notes

A bundler and static site generator driven by one `poops.json`. Read
[CONTRIBUTING.md](CONTRIBUTING.md) first — it defines what belongs in this
project and what a pull request needs.

Poops exists because bundlers got complicated. The dependencies are minimal and
deliberately boring, and the point is to keep them that way: a change that adds
one has to argue for itself, and a feature that can be a few lines of config
beats a plugin system.

## Commands

```bash
script/server    # dev server with live reload, http://localhost:4040
script/build     # builds the example site into example/dist
script/test      # jest
script/lint      # eslint (the authority; CI runs it)
npm run lint:browsers  # stylelint over the compiled CSS, against .browserslistrc
npm run lint:es        # es-check over the emitted JS, at the esbuild target
```

The last two read `example/dist`, so they only mean anything after a build.

## Layout

- `poops.js` is the CLI; every stage is a runner in `lib/` — `styles.js`,
  `scripts.js`, `markups.js`, `postcss.js`, `copy.js`, `exec.js`, `images.js`,
  `server.js`, `reactor.js`.
- Tests live in `lib/__tests__/`, `lib/markup/__tests__/` and
  `script/__tests__/`.
- `example/` is both the documentation site and the test bed — it uses every
  feature Poops has, so `script/build` failing is a real signal.
- `example/dist` is generated and gitignored.

## Documentation

Two places, and a change usually touches both:

- **[README.md](README.md)** is the reference — every config key, with an
  example. It is long on purpose: one page, searchable, no navigation.
- **`example/src/markup/`** is the documentation site, built by Poops itself
  with [poops-docs-theme](https://github.com/stamat/poops-docs-theme) and
  deployed by [pages.yml](.github/workflows/pages.yml). Markdown with front
  matter; `example/src/markup/changelog/` holds the per-release posts.

Rules:

- **Document in the same change as the code.** A new config key that is not in
  README.md does not exist to anyone who did not write it.
- **Edit the section that already covers it.** No new top-level docs files, no
  summary or migration notes nobody asked for.
- **A changelog post is written by hand when it demonstrates the feature** —
  most of them here do, with live samples. `script/changelog` generates one
  only where none exists, and never overwrites yours.

## Principles

- **Test-driven.** The test is the spec; write it first. A failing test means
  the code is wrong — never weaken, skip, or delete a test to make it pass. If
  the test itself is wrong, say so and let review decide.
- **YAGNI.** Build only what the task needs — no speculative options,
  abstractions, or "for later" scaffolding.
- **Stdlib first.** In order: what is already in this repo → `node:` builtins →
  a dependency. Adding one is a last resort and needs a reason.
- **Config over plugins.** A feature that can be a few lines in `poops.json`
  does not get an extension point.
- **Root cause over symptom.** Fix where all callers route through, not the one
  path the bug report names.
- **Delete dead code.** No commented-out blocks, no "for later" exports — git
  remembers.

## Boundaries

- **Always:** run `script/lint` and `script/test` before calling work done;
  pair every fix or feature with a test; document new config in README.md; add
  a changelog entry under `## [Unreleased]`.
- **Ask first:** changing the shape of `poops.json`; adding a dependency;
  changing what a runner emits or where it emits it.
- **Never:** edit `example/dist` (generated); weaken, skip, or delete a test to
  make it pass; bump the version or publish — `script/publish` and a tag do
  that.

## Before adding a feature

Run this checklist before writing any code; stop at the first "no".

1. **Can `poops.json` already express it?** Then it is documentation, not a
   feature.
2. **Does a `node:` builtin or an existing dependency do it?** esbuild, sass,
   nunjucks, liquidjs, marked, chokidar and glob are already here.
3. **Search for prior art.** How do other bundlers expose it, and what do they
   call it? Cite what you found — a URL per fact, no guesses. Can we do it more
   simply? If not, is it worth having here at all?
4. **Does it fit?** CONTRIBUTING.md says what Poops refuses to become. Check
   against that before building, not after.
5. **Still yes?** Build the smallest version that works.

## Non-obvious rules

- **Windows is a supported platform and CI runs there.** Build paths with
  `node:path`, and put anything that ends up in a URL, a glob, or emitted
  output through the helpers in `lib/utils/helpers.js` — `toPosix` and friends
  exist because a backslash leaking into a sitemap is the bug that keeps
  coming back.
- **`poops -b` exits 0 when it has nothing to compile.** A path regression can
  therefore look like a green build; that is why CI asserts the artifacts
  exist.
- **The browser gates run on the compiled bundles, not the sources**, and only
  after a build. `stylelint.config.js` holds nothing but the compat rule.
- **Style is `neostandard`, plus no space before a function paren.**
  `script/lint` is the authority.
