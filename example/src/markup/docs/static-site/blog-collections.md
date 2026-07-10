---
layout: docs
title: Building a blog with collections
navTitle: A blog & collections
description: Turn a directory of posts into a sorted, paginated collection — with front matter, grouping and an RSS feed.
order: 4
keywords: ["blog", "collections", "pagination", "posts", "rss", "sort", "groupby"]
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
state — `pageItems`, `pageNumber`, `totalPages`, `nextPageUrl`, `prevPageUrl`:

```nunjucks
{% raw %}{% for post in blog.pageItems %}
  <h2><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></h2>
{% endfor %}

{% if blog.totalPages > 1 %}
  {% if blog.prevPageUrl %}<a href="{{ relativePathPrefix }}{{ blog.prevPageUrl }}">Previous</a>{% endif %}
  {{ blog.pageNumber }} / {{ blog.totalPages }}
  {% if blog.nextPageUrl %}<a href="{{ relativePathPrefix }}{{ blog.nextPageUrl }}">Next</a>{% endif %}
{% endif %}{% endraw %}
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

## Sorting

`sort` is a field shorthand (`"sort": "title"`) or an object `{ "by": "field", "order": "asc" | "desc" }`.
Sorting by `date` compares dates (default `desc`); any other field compares alphabetically
(default `asc`).

> [!TIP]
> An RSS feed is just a collection rendered into an XML template. Create `blog/feed.rss` that
> loops `blog.items` and emits `<item>` elements — Poops treats it like any other page.

> [!INFO]
> Collection index and pagination pages are included in the **sitemap** but excluded from the
> **search index**, so search results point at posts, not list pages.

Next: [React components](react-components).
