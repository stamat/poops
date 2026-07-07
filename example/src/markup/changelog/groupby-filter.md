---
layout: blog
title: Group posts by year with the groupby filter
date: 2026-07-07
description: A new groupby filter lets you group any array of objects by a field, with optional date-part extraction for year, month or day. Perfect for listing posts per year. Ships alongside a wordcount helper and a baseURL CLI override.
published: true
---

# {{ page.title }}

> {{ page.description }}

The `groupby` filter groups an array of objects by a field value and returns an array of `{ key, items }`. Pass an optional second argument (`year`, `month`, `day`) to group by a date part instead of the raw value. Groups keep insertion order, so sort your posts date-descending and the years come out newest-first for free.

```nunjucks
{% raw %}{% set byYear = collections.items | groupby("date", "year") %}
{% for group in byYear %}
  <h2>{{ group.key }}</h2>
  {% for post in group.items %}
    <p><a href="{{ post.url }}">{{ post.title }}</a></p>
  {% endfor %}
{% endfor %}{% endraw %}
```

Liquid uses the colon syntax: `{% raw %}{{ collections.posts | groupby: "date", "year" }}{% endraw %}`.

## Reading time from word count

Every collection item already carries a `wordcount` property — Poops strips the HTML/Markdown and counts the words when it builds the collection, so you don't compute anything at render time. Turn it into a reading-time estimate by dividing by an average reading speed (~200 words per minute) and rounding up so even a short post reads as "1 min".

```nunjucks
{% raw %}{% for post in collection.items %}
  <h3>{{ post.title }}</h3>
  <small>{{ (post.wordcount / 200) | round(0, "ceil") }} min read</small>
{% endfor %}{% endraw %}
```

Liquid uses `divided_by` with a float divisor (so it doesn't do integer division) and `ceil`:

```liquid
{% raw %}{% for post in collection.items %}
  <h3>{{ post.title }}</h3>
  <small>{{ post.wordcount | divided_by: 200.0 | ceil }} min read</small>
{% endfor %}{% endraw %}
```

Bump 200 to whatever fits your audience — 225 for skimmers, 130 for dense technical prose.

## Also in this release

- `--base-url` CLI flag — overrides `baseURL` at build time, so GitHub Actions can point the same source at different deploy targets.

## Testing it

{% set byYear = changelog.items | groupby("date", "year") %}
{% for group in byYear %}

  <p>{{ group.key }}</p>
  {% for post in group.items %}
    <p><a href="{{ post.url }}">{{ post.title }}</a> <small>({{ (post.wordcount / 200) | round(0, "ceil") }} min read)</small></p>
  {% endfor %}
{% endfor %}
