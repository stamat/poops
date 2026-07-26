---
layout: post
title: v1.8.0 — auto RSS / Atom feeds from collections
date: 2026-07-26
description: A new feed option generates a subscription feed straight from a collection — newest-first, channel metadata from your site data, RSS or Atom — replacing the hand-authored feed.rss template.
published: true
---

Collections already know your posts, their dates and their descriptions. Now they can emit a subscription feed with a single config line — no hand-authored XML template to keep in sync.

## Point it at a collection

```json
{% raw %}{
  "markup": {
    "options": {
      "feed": { "collection": "changelog", "output": "changelog/feed.rss" }
    }
  }
}{% endraw %}
```

That writes `changelog/feed.rss` — the collection's posts newest-first by `date`, with the channel title, description, author and language taken from your `site` data. Item links, `guid`s and the `atom:link rel="self"` are made absolute via `site.url`; each `<description>` uses the post's `description`, falling back to its auto-`excerpt`. Posts marked `robots: noindex` are left out, matching the sitemap.

Advertise it in your layout `<head>` so browsers and readers discover it:

```html
{% raw %}<link rel="alternate" type="application/rss+xml" href="{{ site.url }}/changelog/feed.rss">{% endraw %}
```

## Options

- `collection` — the collection to feed from. **Omit it** to emit a feed for every collection.
- `output` — a bare filename (default `feed.xml`) lands in the collection's own folder; a slashed path is written as-is.
- `type` — `"rss"` (default) or `"atom"`.
- `limit` — item cap, newest first (default 20).
- `title` / `description` / `author` / `lang` — override the `site` defaults.

Shorthand `"feed": true` (or a filename string) turns on RSS for every collection; an array of these objects generates several at once — say an RSS and an Atom for the same posts.

This changelog is a collection, so the feed you may already subscribe to at `/changelog/feed.rss` is now generated — the old hand-written template is gone.
