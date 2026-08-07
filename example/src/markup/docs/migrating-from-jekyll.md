---
layout: poops-docs-theme/docs
title: Migrating from Jekyll
navTitle: Migrate from Jekyll
description: Every Jekyll concept mapped to its Poops equivalent — directories, front matter, Liquid dialect, plugins — and the four that have no equivalent.
order: 8
keywords: ["jekyll", "migration", "migrate", "liquid", "_posts", "permalink", "front matter", "gems"]
---

# Migrating from Jekyll

Poops is Jekyll-inspired, so most of the move is renaming directories and deleting a Gemfile. Four
things are not a rename, and they are the reason a migration stalls halfway — read these first, then
the mapping tables.

| The thing | What happens | What you do |
| --- | --- | --- |
| **`permalink`** | Not supported. A page's output path mirrors its source path, always: `src/markup/blog/hello.md` → `dist/blog/hello.html` | Move the files to where the URLs should be. Keep old URLs alive with redirects on the host, or accept the change |
| **Dates in `_posts` filenames** | Not parsed. `2024-01-05-hello.md` becomes `2024-01-05-hello.html`, and the post has no date | Rename the files and put `date:` in front matter — the build warns on any post without one and falls back to mtime, which a CI checkout resets |
| **Liquid dialect** | Poops' Liquid is [LiquidJS](https://liquidjs.com/), not Jekyll's Ruby Liquid. `{% raw %}{% include %}{% endraw %}`, `{% raw %}{% highlight %}{% endraw %}` and Jekyll's filter set differ | Port the tags in the table below, or switch the site to Nunjucks while you are in there |
| **Gem plugins** | There is no plugin API | The common ones are config keys — see the plugin table. Anything else has to become a build step or go |

Everything else is mechanical.

## Directories

Jekyll's layout, and where each part lands:

| Jekyll | Poops | Note |
| --- | --- | --- |
| `_config.yml` | `poops.json` | One file, all pipelines. Not YAML — JSON with `$schema` completion |
| `_layouts/` | `_layouts/` under `markup.in` | Underscore directories are never output. Add it to `includePaths` |
| `_includes/` | `_partials/` (any name) under `markup.in` | Also on `includePaths`; `{% raw %}{% render "site-header.liquid" %}{% endraw %}` |
| `_data/` | `markup.options.data` | An explicit list of files: `["_data/links.json", "_data/authors.yaml"]` |
| `_posts/` | any direct subdirectory of `markup.in` | It becomes a [collection](static-site/blog-collections); the directory name is the collection name |
| `_drafts/` | `published: false` in front matter | The page is skipped and kept out of the collection |
| `_sass/` | anywhere; `styles[].in` points at your entry | Dart Sass, with `includePaths` for the load path |
| `assets/` | `copy`, or `styles`/`scripts` entries | Static files get copied; sources get compiled |
| `_site/` | `markup.out` | Whatever you name it — `dist` in these docs |

## Config

| `_config.yml` | `poops.json` |
| --- | --- |
| `title`, `description`, `author` | `markup.options.site.title`, `.description`, … — anything under `site` reaches every template |
| `url` | `markup.options.site.url` — used by the `canonical`, `og` and `jsonld` filters and by `sitemap.xml` |
| `baseurl` | `markup.options.baseURL`, or the `--base-url` flag in CI. Leave it unset and paths stay relative — [see deploying](deploying) |
| `collections:` | `markup.options.collections`, or `collection: true` in the directory's index front matter |
| `paginate: 10` | `paginate: 10` on the collection |
| `defaults:` (front-matter defaults) | **no equivalent** — set the field per page, or read `site` in the layout as the fallback |
| `exclude:`/`include:` | underscore-prefixed directories are excluded; there is no include list |
| `markdown:`/`kramdown:` | fixed: [marked](https://marked.js.org/) with GFM, alerts, footnotes, emoji and build-time syntax highlighting |

A minimal blog, whole:

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "options": {
      "engine": "liquid",
      "site": { "title": "My Site", "url": "https://example.com" },
      "includePaths": ["_layouts", "_partials"],
      "data": ["_data/links.json"],
      "sitemap": "sitemap.xml",
      "feed": { "collection": "blog", "out": "feed.rss" }
    }
  },
  "styles": [{ "in": "src/scss/index.scss", "out": "dist/css/styles.css", "options": { "minify": true } }],
  "watch": ["src"],
  "livereload": true
}
```

## Front matter

| Jekyll | Poops |
| --- | --- |
| `layout: default` | same — resolved from `includePaths`, or `package/layout` from `node_modules` |
| `title`, `description` | same |
| `date` | same, and now **required** on posts you care about ordering |
| `published: false` | same |
| `categories`, `tags` | any field becomes a [taxonomy](static-site/blog-collections) when the collection declares it: `taxonomies: [tags]` |
| `permalink` | **gone** — the file path is the URL |
| `excerpt_separator` | **gone** — `page.excerpt` is the first prose paragraph, capped at 160 characters |
| `sitemap: false` | `robots: noindex` — drops the page from the sitemap and `llms.txt`, keeps it in your on-site search index |

## Liquid, ported

Both engines are available; `engine: "liquid"` keeps your templates closest. The dialect still moves:

| Jekyll | Poops |
| --- | --- |
| `{% raw %}{% include site-header.html %}{% endraw %}` | `{% raw %}{% render "site-header.liquid" %}{% endraw %}` — LiquidJS names the file with quotes and an extension |
| `{% raw %}{{ content }}{% endraw %}` in a layout | `{% raw %}{% block content %}{% endblock %}{% endraw %}` — in **both** engines. Poops wraps the page body in a `content` block and the layout declares where it goes; a Liquid layout that still says `{% raw %}{{ content }}{% endraw %}` renders empty |
| `{% raw %}{% for post in site.posts %}{% endraw %}` | `{% raw %}{% for post in blog.items %}{% endraw %}` — every collection is a global named after its directory |
| `{% raw %}{{ site.baseurl }}/css/styles.css{% endraw %}` | `{% raw %}{{ relativePathPrefix }}css/styles.css{% endraw %}` — correct at any depth and under any deploy path |
| `{% raw %}{% highlight js %}…{% endhighlight %}{% endraw %}` | same tag, quoted language: `{% raw %}{% highlight 'javascript' %}…{% endhighlight %}{% endraw %}`. Markdown fences are highlighted with no tag at all |
| `{% raw %}{{ post.date \| date: "%b %-d, %Y" }}{% endraw %}` | `{% raw %}{{ post.date \| date: "MMM D, YYYY" }}{% endraw %}` — [dayjs](https://day.js.org/) tokens, with a site-wide `dateFormat` default |
| `{% raw %}{{ page.content \| strip_html \| truncatewords: 30 }}{% endraw %}` | `{% raw %}{{ page.excerpt }}{% endraw %}` |
| `{% raw %}{% seo %}{% endraw %}` (jekyll-seo-tag) | `{% raw %}{{ page \| og(site) }}{% endraw %}`, `{% raw %}{{ page \| canonical(site) }}{% endraw %}`, `{% raw %}{{ page \| jsonld(site) }}{% endraw %}` |

## Plugins

| Gem | Poops |
| --- | --- |
| `jekyll-feed` | `markup.options.feed` — RSS or Atom, one key |
| `jekyll-sitemap` | `markup.options.sitemap` |
| `jekyll-seo-tag` | the `og`, `canonical` and `jsonld` filters |
| `jekyll-paginate` | `paginate` on the collection, plus the `{% raw %}{% pagination %}{% endraw %}` tag |
| `jekyll-archives` | `taxonomies` on the collection — term pages, paginated, in the sitemap |
| `jekyll-assets` / a separate webpack | `styles`, `scripts`, `postcss` — the reason to move |
| `jekyll-redirect-from` | **nothing** — do redirects at the host |
| A theme gem | one theme exists, [`poops-docs-theme`](https://github.com/stamat/poops-docs-theme), and it is a devDependency, not a gem |

## The order that works

1. **Copy the site into `src/markup/`.** Rename `_includes` to `_partials` if you like; the name is
   yours as long as it starts with an underscore and is on `includePaths`.
2. **Rename `_posts` to the URL you want** — `blog/` — and strip the date prefixes from filenames.
3. **Add `date:` to every post's front matter.** The build lists the ones you missed.
4. **Write `poops.json`** from the config table above, with `"engine": "liquid"`.
5. **Run `poops -b` and read the errors.** Unknown tags are the Liquid dialect; empty output is
   usually a `site.posts` that is now `blog.items`.
6. **Delete `Gemfile`, `Gemfile.lock`, `_config.yml`, `_site/`.** Add `dist/` to `.gitignore`.
7. **Replace the GitHub Pages branch build with [a workflow](deploying)** — Pages no longer
   builds the site for you, and this is the step that catches people after the site already works
   locally.

> [!NOTE]
> These pages are a mapping, not a script. Nothing here was run against an existing Jekyll site —
> the Poops side of every row is documented behaviour, the Jekyll side is from
> [its docs](https://jekyllrb.com/docs/), and your site will have a case neither of us thought of.

## When not to migrate

The site is Markdown and layouts with no assets to build, GitHub builds it for free on push, and the
theme you use is a gem. That is Jekyll working as designed — see [the comparison](comparisons/jekyll-eleventy)
for the rows it wins outright.
