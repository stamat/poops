---
layout: poops-docs-theme/docs
title: Publishing to GitHub Pages
navTitle: Publish on GitHub Pages
description: Build a Poops site in GitHub Actions and deploy it to GitHub Pages — the workflow, the permissions it needs, the base URL flag, and the two things that break a green deploy.
order: 6
keywords: ["github pages", "github actions", "ci", "deploy", "publish", "base-url", "workflow", "custom domain"]
---

# Publishing to GitHub Pages

The build is green, the deploy is green, and the live site is unstyled with every link one level
off. Nothing failed: a project site is served from `https://user.github.io/repo/`, not from `/`, and
any absolute `/css/styles.css` you wrote points at a directory GitHub never made.

Poops writes **relative** path prefixes by default — `./`, `../` — precisely so a build works
wherever it lands, subdirectory included. Use `{% raw %}{{ relativePathPrefix }}{% endraw %}` for every asset and link
and you can stop reading after the workflow. Hardcode a leading slash anywhere, or need absolute
URLs in `sitemap.xml` and `og:` tags, and the fix is one flag: `--base-url /repo`.

## Turn Pages on first

**Settings → Pages → Build and deployment → Source: GitHub Actions.** The workflow below uploads an
artifact and asks Pages to publish it; while the source is still *Deploy from a branch*, there is
nothing on the other end of that request.

## The workflow

`.github/workflows/pages.yml`:

```yaml
{% raw %}name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      # The repo name is the subdirectory the site is served from.
      - run: npx poops --build --base-url /${{ github.event.repository.name }}

      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist

      - id: deployment
        uses: actions/deploy-pages@v4{% endraw %}
```

That is the shape this site deploys with — [pages.yml](https://github.com/stamat/poops/blob/main/.github/workflows/pages.yml)
in the Poops repo is the same file with `example/dist` as the artifact path, because the docs site
lives inside the repo that builds it. Point `path:` at whatever your `markup.out` is.

Three lines carry the weight:

| Line | Why it is there |
| --- | --- |
| `permissions: pages: write, id-token: write` | `deploy-pages` authenticates with an OIDC token minted per run. Without `id-token: write` the deploy step fails; no secret is stored anywhere either way. |
| `concurrency: group: pages` | Two pushes in a minute otherwise race for the same Pages deployment. The later one wins, and which one that is depends on timing. |
| `npm ci` | Installs exactly the lockfile. `npm install` may resolve a newer minor of a dependency than the one you tested — on a static site that shows up as a layout that moved, months later. |

> [!TIP]
> `cache: npm` on `setup-node` needs a lockfile in the repo. No lockfile, no cache — and no `npm ci`
> either; that step wants one too.

## When you need `--base-url`, and when you do not

| Where the site lives | Flag | Why |
| --- | --- | --- |
| `user.github.io/repo/` (project site) | `--base-url /repo` | `{% raw %}{{ relativePathPrefix }}{% endraw %}` resolves to `/repo/` everywhere instead of a per-page `../`. Required the moment anything is absolute. |
| `user.github.io` (user site, repo `user.github.io`) | none | The site *is* the root. A base URL of `/user.github.io` would be wrong. |
| A custom domain | none | Same reason — the site is at the root of that domain. |

The flag overrides `markup.options.baseURL` from the config, which is the point: one config file,
different deploy paths per environment. Leaving both unset keeps prefixes relative, which also
works from `file://` — open `dist/index.html` in a browser and the site still works.

Absolute URLs — `sitemap.xml`, canonical links, `og:image`, JSON-LD — come from `site.url` instead,
so set that to the deployed address:

```json
"markup": {
  "options": {
    "site": { "url": "https://user.github.io/repo" }
  }
}
```

## A custom domain

Two things, and the order does not matter:

1. Point the DNS at GitHub, and set the domain under **Settings → Pages → Custom domain**.
2. Keep a `CNAME` file in the published output. Pages reads it from the artifact root, so put it in
   your markup input directory or `copy` it in:

```json
"copy": [{ "in": "src/CNAME", "out": "dist" }]
```

Then drop `--base-url` from the workflow and set `site.url` to the domain. A stale `--base-url` on
a custom domain is the same 404 as before, in the other direction.

## What still bites

| Symptom | Cause | Fix |
| --- | --- | --- |
| Posts reshuffle between deploys | A post with no `date` in front matter falls back to file mtime, and `git clone` on a runner sets mtime to checkout time | Put a real `date` in front matter — the build already warns about this |
| Assets 404 only in production | An absolute `/css/...` in a layout | `{% raw %}{{ relativePathPrefix }}{% endraw %}css/...`, or `--base-url` |
| Deploy publishes an empty site | `path:` in `upload-pages-artifact` does not match `markup.out` | They are two separate strings; keep them in step |
| Nothing deploys, no error | `poops -b` exits 0 when it has nothing to compile — a wrong path is a green build | Assert an artifact exists: `test -f dist/index.html` |

The last one is worth a step of its own in any workflow you care about:

```yaml
      - name: Verify build output
        run: test -f dist/index.html && test -f dist/sitemap.xml
```

## The other route: deploy from a branch

Committing `dist` to a `gh-pages` branch still works, and it is what you fall back to when the site
is built somewhere other than Actions.

| | Actions artifact | `gh-pages` branch |
| --- | --- | --- |
| What is stored | nothing — the artifact is transient | every build, forever, in git history |
| Jekyll runs on it | no, the artifact is served as uploaded | **yes** — branch sources are built with Jekyll unless a `.nojekyll` file sits at the root |
| Needs | Pages source set to GitHub Actions | a push token and a branch |
| Rollback | re-run an older workflow | `git revert` |

Jekyll on a branch deploy eats any directory starting with an underscore, which is exactly what a
Poops `_layouts` or `_partials` directory is called if it ever reaches the output. Add `.nojekyll`
and the problem disappears; on the Actions route it never appears.
