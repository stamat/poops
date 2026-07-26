---
layout: docs
title: Building a blog with collections
navTitle: A blog & collections
description: Turn a directory of posts into a sorted, paginated collection — with front matter, grouping and an RSS feed.
order: 4
keywords: ["blog", "collections", "pagination", "posts", "rss", "sort", "groupby", "tags", "categories", "taxonomies"]
---

# Building a blog with collections

A **collection** turns a directory of pages into a sorted, optionally paginated list — blog posts,
changelog entries, docs. Each direct subdirectory of your markup `in` can be a collection; every
file inside it (except `index.*`) becomes an item.

## Declaring a collection

**Option A — front matter** on the directory's `index` file:

```yaml
---
title: Blog
collection: true
paginate: 10
sort: date
---
```

`collection: true` uses the directory name; a string names it explicitly. **Option B — config**,
listing collections by name (must match a subdirectory of `in`):

```json
{
  "markup": {
    "in": "src/markup",
    "out": "dist",
    "collections": [
      "changelog",
      { "name": "blog", "paginate": 5, "sort": { "by": "date", "order": "desc" } }
    ]
  }
}
```

## Writing a post

A post is a normal Markdown file with front matter:

```markdown
---
layout: post
title: Hello world
date: 2026-07-09
description: My first post built with Poops.
tags: [poops, static-site]
published: true
---

Welcome to the blog.
```

> [!WARNING]
> Always set a real `date` in front matter. Undated posts fall back to the file's modification
> time — meaningless on CI, where a fresh `git clone` resets mtimes, so posts would reshuffle
> between deploys. A post with `published: false` is excluded and its page isn't built.

## Listing posts

Every collection is a global named after it. Loop its `items`:

```nunjucks
{% raw %}{% for post in blog.items %}
  <article>
    <h2><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></h2>
    <time>{{ post.date | date("MMMM D, YYYY") }}</time>
    <p>{{ post.description }}</p>
  </article>
{% endfor %}{% endraw %}
```

Each item carries its front matter plus `url`, `title`, `date`, `wordcount`, `fileName`,
`filePath` and `collection`.

## Pagination

With `paginate: N`, the collection's index renders once per page: page 1 → `blog/index.html`,
page 2 → `blog/2/index.html`, and so on. Inside the index, the collection object carries page
state — `pageItems`, `pageNumber`, `totalPages`, `pageUrl`, `nextPageUrl`, `prevPageUrl`:

Set `paginate: N` on the collection index front matter (or the collection entry in `markup.collections`);
without it, there is only one page and the pagination globals stay at their single-page defaults.

```nunjucks
{% raw %}{% for post in blog.pageItems %}
  <h2><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></h2>
{% endfor %}
{% pagination blog %}{% endraw %}
```

`{% raw %}{% pagination blog %}{% endraw %}` works in both Nunjucks and Liquid.

> [!NOTE]
> `{% raw %}{% pagination blog %}{% endraw %}` is just a convenience tag. The generated globals
> are always available, so you can render pagination manually when you need custom markup.

```nunjucks
{% raw %}{% if blog.totalPages > 1 %}
  <nav aria-label="Pagination">
    {% if blog.prevPageUrl %}<a href="{{ relativePathPrefix }}{{ blog.prevPageUrl }}">Previous</a>{% endif %}
    <span data-page="{{ blog.pageNumber }}" data-total-pages="{{ blog.totalPages }}">
      Page {{ blog.pageNumber }} of {{ blog.totalPages }}
    </span>
    {% if blog.nextPageUrl %}<a href="{{ relativePathPrefix }}{{ blog.nextPageUrl }}">Next</a>{% endif %}
  </nav>
{% endif %}{% endraw %}
```

Pages 2..N automatically get a distinct `<title>` — `Blog — Page 2` — so the paginated pages don't
all share the landing page's title (and its `og`/`jsonld` metadata). Page 1 keeps its own title.

### Localizing the labels

The `— Page N` title suffix and the `{% raw %}{% pagination %}{% endraw %}` tag's wording default to
English. Override them site-wide under `site.pagination` (the same term-page titles and breadcrumbs
localize too — see [Tags & categories](#tags-categories-taxonomies)):

```yaml
site:
  pagination:
    title: "{title} — Seite {n}"   # {title}, {n}, {total} tokens; used on pages 2..N
    prev: Zurück
    next: Weiter
    of: von                        # the "{n} von {total}" separator
```

## Grouping posts by year

The `groupby` filter groups any array of objects by a field, with optional date-part extraction.
Groups keep insertion order, so sort descending and years come out newest-first:

```nunjucks
{% raw %}{% for group in blog.items | groupby("date", "year") %}
  <h2>{{ group.key }}</h2>
  {% for post in group.items %}
    <p><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></p>
  {% endfor %}
{% endfor %}{% endraw %}
```

## Tags & categories (taxonomies)

Grouping lists terms on one page. A **taxonomy** goes further: it gives every term its own
paginated landing page — `changelog/tag/feature/`, `changelog/category/release/` — crawlable and
shareable. Declare which front-matter fields become taxonomies on the collection, alongside
`paginate`/`sort`:

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

Shorthand: a bare string (`taxonomies: [tags, category]`) uses the field name as the URL segment
and inherits the collection's `paginate`. Array-valued fields split per element — a post with
`tags: [js, css]` lands under **both** `tag/js/` and `tag/css/`. Terms are slugified for the URL
(`Static Site` → `static-site`).

Pages render with the **collection's own index template** — no extra file. On a term page the
collection object carries the term context; branch on `activeTerm` to render a term view:

```nunjucks
{% raw %}{% if changelog.activeTerm %}
  <h1>Tagged {{ changelog.activeTerm | humanize }}</h1>
  {% for post in changelog.pageItems %}
    <p><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></p>
  {% endfor %}
  {% pagination changelog %}
{% endif %}{% endraw %}
```

On a term page `items`/`pageItems` are scoped to that term (so `pagination` and `groupby` narrow to
it too); `activeTaxonomy` holds the URL segment and `activeTermSlug` the slug. Build tag links
anywhere from `collection.taxonomies`:

```nunjucks
{% raw %}{% for tax in changelog.taxonomies %}
  {% for term in tax.terms %}
    <a href="{{ relativePathPrefix }}{{ term.url }}">{{ term.term | humanize }} ({{ term.count }})</a>
  {% endfor %}
{% endfor %}{% endraw %}
```

Each term exposes `term`, `slug`, `url`, `count` and `totalPages`. The `slugify` and `humanize`
filters (inverses of each other) are handy for building and displaying terms. Each term page also
gets a distinct `<title>` and `og`/`jsonld` metadata — `Tag: Feature` (paged: `Tag: Feature — Page
2`) — instead of the shared landing title. The `breadcrumb` and `jsonld` filters resolve term pages
to a **Home › Collection › Tag: Term** trail automatically (the last crumb carries the same
taxonomy label, and the non-page `tag`/`category` URL segment is skipped), so nothing extra is
needed there.

> [!NOTE]
> Term pages are treated like pagination pages: listed in the **sitemap** (crawlable) but kept out
> of the **search index**, **llms.txt** and **nav**, so those point at posts, not term listings.

## Sorting

`sort` is a field shorthand (`"sort": "title"`) or an object `{ "by": "field", "order": "asc" | "desc" }`.
Sorting by `date` compares dates (default `desc`); any other field compares alphabetically
(default `asc`).

## RSS / Atom feed

Point the `feed` option at the collection and Poops writes a subscription feed — no hand-authored
XML template. Items are the posts newest-first by `date`, channel metadata comes from your `site`
data:

```json
{
  "markup": {
    "options": {
      "feed": { "collection": "blog", "output": "blog/feed.rss" }
    }
  }
}
```

`type: "atom"` switches format, `limit` caps the item count (default 20), and omitting `collection`
emits a feed for every collection. Then advertise it in your layout `<head>`:

```html
{% raw %}<link rel="alternate" type="application/rss+xml" href="{{ site.url }}/blog/feed.rss">{% endraw %}
```

Full option table in the [config reference](../config-reference#markup-feed).

> [!INFO]
> Collection index and pagination pages are included in the **sitemap** but excluded from the
> **search index**, so search results point at posts, not list pages.

Next: [React components](react-components).
