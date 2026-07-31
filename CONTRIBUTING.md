# Contributing to Poops

Issues and pull requests are welcome.

Poops exists because bundlers got complicated. Its dependencies are minimal and
deliberately boring, and the point is to keep them that way — a change that adds
a dependency needs to argue for itself, and a feature that can be a few lines of
config beats a plugin system.

## Getting set up

```bash
git clone https://github.com/stamat/poops.git
cd poops
npm install
```

```bash
script/test      # jest, same as `npm test`
npm run lint     # eslint
script/build     # builds the example site into example/dist
script/server    # dev server with live reload, http://localhost:4040
```

The `example/` directory is both the documentation site and the test bed — it
uses every feature Poops has, so `script/build` failing is a real signal.

## Reporting a bug

Include your `poops.json`, the Poops version, your Node version and OS, and what
the terminal printed. A config that reproduces the problem is worth more than a
description of it — most bugs here live in path handling, and paths differ by
platform.

## Pull requests

- **Add a test.** Runners live in `lib/`, tests in `lib/__tests__/` and
  `lib/markup/__tests__/`. A bug fix gets a test that fails without the fix.
- **Keep it cross-platform.** Poops runs on Windows and CI checks it there
  across Node 20, 22 and 24. Build paths with `node:path`, and pass anything
  that ends up in a URL, a glob, or emitted output through the helpers in
  `lib/utils/helpers.js` — `toPosix` and friends exist because a backslash
  leaking into a sitemap is the bug that keeps coming back.
- **Match the surrounding style.** `neostandard`, plus no space before a
  function paren. `npm run lint` is the authority, and CI runs it.
- **Add a changelog entry** under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md) — that file explains the format.

Commit messages are freeform, write something that says what changed.

## How a release works

Maintainer flow, recorded here so the automation isn't a mystery:

`script/publish [version]` bumps `package.json`, runs `script/changelog` to cut
`[Unreleased]` into a released entry, builds, tags and pushes. Pushing the tag
triggers [publish.yml](.github/workflows/publish.yml), which publishes to npm via
trusted publishing — OIDC, no tokens stored anywhere.

`script/changelog` also writes `example/src/markup/changelog/v<version>.md` from
the entry, unless a post already exists at that path. Most Poops releases have a
hand-written post, because the post demonstrates the feature it describes — a
generated one can't do that. Write the post first and the generator leaves it
alone.
