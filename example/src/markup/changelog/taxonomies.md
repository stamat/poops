---
layout: post
title: v1.7.0 — Tags & categories (taxonomies)
description: Collections can now turn tags and categories into their own paginated, crawlable landing pages — changelog/tag/feature/, blog/category/release/ — rendered with the collection's own index template. Ships with an array-aware groupby, a humanize filter, distinct titles for paginated and term pages, localizable pagination labels, and automatic breadcrumbs for term pages.
date: 2026-07-26
tags: [feature, collections]
published: true
---

Grouping posts by a field was already possible with the `groupby` filter, but it lived on a single page. **Taxonomies** give every term its own paginated, crawlable landing page — and this release rounds out the collection story with a handful of supporting improvements. This very changelog groups its entries by tag (the links at the top).

## Tags & categories — `taxonomies`

Declare which front-matter fields become taxonomies on the collection, alongside `paginate`/`sort`:

```yaml
---
title: Changelog
collection: true
paginate: 10
taxonomies:
  - name: tags      # front-matter field to group on
    path: tag       # URL segment (defaults to name); use "tag" for a singular URL
    paginate: 5     # per-term page size (defaults to the collection's paginate)
---
```

Shorthand: a bare string (`taxonomies: [tags, category]`) uses the field name as the URL segment and inherits the collection's `paginate`. Poops then writes a landing page per term — `changelog/tag/feature/`, `blog/category/release/` — paginated, listed in the sitemap, kept out of the search index and nav.

Term pages render with the **collection's own index template** — no extra file. Branch on `activeTerm` to show a term view, and build tag links anywhere from `collection.taxonomies`:

```nunjucks
{% raw %}{% if changelog.activeTerm %}
  <h1>Tagged {{ changelog.activeTerm | humanize }}</h1>
  {% for post in changelog.pageItems %}
    <p><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></p>
  {% endfor %}
  {% pagination changelog %}
{% endif %}{% endraw %}
```

Full guide: [Tags & categories](../docs/static-site/blog-collections#tags-categories-taxonomies).

## Array-aware `groupby`

The `groupby` filter now splits array-valued fields: a post with `tags: [js, css]` lands under **both** the `js` and `css` groups (previously the whole array was one key). This is what makes multi-tag taxonomies work, and it's just as useful in a template:

```nunjucks
{% raw %}{% for group in blog.items | groupby("tags") %}
  <h2>{{ group.key | humanize }}</h2>
{% endfor %}{% endraw %}
```

## New `humanize` filter

The inverse of `slugify`: `"static-site"` → `"Static Site"`. Handy for turning a slug or a raw tag into a display label. Available in both Nunjucks and Liquid.

## Distinct titles for paginated & term pages

Paginated pages no longer all share the landing page's `<title>` (and its `og`/`jsonld` metadata). Pages 2..N get a `— Page N` suffix, and each term page gets a `Tag: Feature` title — so search engines and social cards see a distinct title per page.

## Localizable pagination labels

The `— Page N` suffix and the `{% raw %}{% pagination %}{% endraw %}` tag's `Previous`/`Next`/`of` wording default to English but localize site-wide under `site.pagination`:

```yaml
site:
  pagination:
    title: "{title} — Seite {n}"   # {title}, {n}, {total} tokens
    prev: Zurück
    next: Weiter
    of: von
```

## Automatic breadcrumbs for term pages

The `breadcrumb` and `jsonld` filters resolve term pages to a **Home › Collection › Tag: Term** trail automatically — skipping the non-page `tag`/`category` URL segment and labelling the last crumb with the taxonomy. Nothing to configure.

Everything above is additive — existing sites build unchanged.
