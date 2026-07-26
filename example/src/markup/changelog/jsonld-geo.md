---
layout: post
title: v1.6.0 — SEO metadata, breadcrumbs, feeds and llms.txt
date: 2026-07-26
description: Zero-config SEO in one release — og and jsonld filters emit page metadata and structured data from front matter, nested pages auto-get breadcrumbs (a BreadcrumbList rich result plus a visible trail), a new feed option generates RSS/Atom straight from a collection (optionally with full post content), and llms.txt / llms-full.txt hand LLMs a map and the whole corpus.
published: true
---

One release, several ways to stop hand-authoring the boilerplate search engines, social platforms, feed readers and LLMs consume — all driven from front matter you already write.

## SEO metadata — `og` and `jsonld`

Two new filters generate the metadata that search engines, generative engines (GEO) and social platforms read — straight from your front matter, no per-page boilerplate. Drop both in your layout `<head>`:

```nunjucks
{% raw %}{{ page | og(site) }}
{{ page | jsonld(site) }}{% endraw %}
```

### Open Graph & Twitter cards — `og`

The `og` filter emits [Open Graph](https://ogp.me/) and Twitter-card `<meta>` tags so links to your pages unfurl into rich previews in chat apps and social feeds. `og:type` is `article` when the page has a `date`, otherwise `website`. It pulls `title`, `description`, `url` (made absolute via `site.url`), `image`, `site_name` and `locale` from front matter and site data, adds `article:published_time` / `article:modified_time` / `article:author` for posts, and sets `twitter:card` to `summary_large_image` when there's an image. Attribute values are escaped.

Set an `og` object in front matter to add or override any tag:

```yaml
---
title: My post
date: 2026-01-01
image: static/cover.jpg
og:
  "og:image:alt": Cover illustration
---
```

### JSON-LD structured data — `jsonld`

The `jsonld` filter turns front matter into a schema.org [JSON-LD](https://json-ld.org/) `<script type="application/ld+json">` block — structured data search and generative engines read to understand your content. Liquid uses the colon syntax: `{% raw %}{{ page | jsonld: site }}{% endraw %}`.

The `@type` auto-detects: `BlogPosting` when the page has a `date`, otherwise `WebPage`. These front-matter fields are used when present:

| Front matter | JSON-LD |
| --- | --- |
| `title` | `name` / `headline` |
| `description` (or `site.description`) | `description` |
| `url` (made absolute via `site.url`) | `url` |
| `date` | `datePublished` |
| `updated` (or `date`) | `dateModified` |
| `author` string or `{ name }` (or `site.author`) | `author` (Person) |
| `image` | `image` |
| `lang` (or `site.lang`) | `inLanguage` |
| `wordcount` | `wordCount` |
| `site.title` | `publisher` (Organization) |

Article-only fields (`headline`, dates, `author`, `wordCount`) are added only for the `BlogPosting` case. Front-matter values are escaped so a stray `</script>` in a title can't break out of the tag.

The same `lang` that drives `inLanguage` also declares the document language — wire `{% raw %}<html lang="{{ page.lang or site.lang or 'en' }}">{% endraw %}` in your layout so the markup and the structured data agree. `site.lang` sets the default; a page's front-matter `lang` overrides it.

Set a `jsonld` object in front matter — its keys merge over (and override) the generated defaults, including `@type`. Everything from a `HowTo` to an `FAQPage` to a `Product`:

```yaml
---
title: How to brew coffee
date: 2026-01-01
jsonld:
  "@type": HowTo
  totalTime: PT5M
---
```

This very page emits both — an `article` Open Graph set and a `BlogPosting` JSON-LD block. View source and look in the `<head>`.

## Breadcrumbs

Breadcrumbs land in two forms, both derived from a page's URL depth — no nav tree wiring, no per-page boilerplate.

### The SEO half is automatic

The `jsonld` filter above now auto-appends a schema.org `BreadcrumbList` block on any **nested** page (its `url` has at least one folder). It's a [Google breadcrumb rich result](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) with zero extra markup:

```nunjucks
{% raw %}{{ page | jsonld(site) }}{% endraw %}
```

The trail is the site root, each ancestor folder (humanized — `docs/static-site` → *Static Site*), then the page itself. Item URLs are absolute, so it needs `site.url` (same requirement as `canonical`). Sits right alongside the existing homepage `WebSite` block.

### A visible trail — `breadcrumb`

For a breadcrumb people can see and click, add the new `breadcrumb` filter in your body. Same crumbs, rendered as a `{% raw %}<nav class="breadcrumb"><ol>{% endraw %}`:

```nunjucks
{% raw %}{{ page | breadcrumb(site, relativePathPrefix) }}{% endraw %}
```

Liquid uses the colon syntax: `{% raw %}{{ page | breadcrumb: site, relativePathPrefix }}{% endraw %}`.

Passing `relativePathPrefix` matters: the links resolve against the current page — localhost while you develop, your deployed path in production — instead of jumping to the absolute domain. It's the same convention the nav and header links already use. The last crumb is the current page, rendered as `aria-current` text rather than a link. Both the JSON-LD and the visible trail return nothing on the homepage or a single-crumb page. Style the `.breadcrumb` however you like.

### Optional home crumb

The leading "Home" crumb is on by default. Drop it or rename it site-wide via `site.breadcrumb`, or per page in front matter — front matter wins:

```yaml
# poops.json → markup.site
breadcrumb:
  home: false        # drop the leading "Home" crumb
  homeLabel: Start   # …or just rename it
```

With `home: false`, top-level pages fall to a single crumb and render nothing, while nested pages still show their folder trail — handy for a blog where you want *Blog › Post*, not *Home › Blog › Post*. Set `breadcrumb: false` on a page (or on `site`) to switch off both the visible trail and the JSON-LD entirely.

The docs pages and these changelog posts render a live trail — look just above the content, and view source for the `BreadcrumbList` in the `<head>`.

## Auto RSS / Atom feeds from collections

Collections already know your posts, their dates and their descriptions. Now they can emit a subscription feed with a single config line — no hand-authored XML template to keep in sync.

### Point it at a collection

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

### Options

- `collection` — the collection to feed from. **Omit it** to emit a feed for every collection.
- `output` — a bare filename (default `feed.xml`) lands in the collection's own folder; a slashed path is written as-is.
- `type` — `"rss"` (default) or `"atom"`.
- `limit` — item cap, newest first (default 20).
- `title` / `description` / `author` / `lang` — override the `site` defaults.
- `content` — set `true` to embed each post's full article in the feed (see below).

Shorthand `"feed": true` (or a filename string) turns on RSS for every collection; an array of these objects generates several at once — say an RSS and an Atom for the same posts.

### Full post content — `content: true`

By default items carry a `<description>` only. Set `content: true` and each post's whole article rides along — RSS `<content:encoded>`, Atom `<content type="html">` — so readers show the full post without a round-trip to the site:

```json
{% raw %}{ "feed": { "collection": "changelog", "output": "changelog/feed.rss", "content": true } }{% endraw %}
```

The HTML is the post's Markdown **source** rendered to article-body HTML — no layout, nav or footer chrome, just the content. Only `.md`/`.markdown` posts get it (a `.njk`/`.liquid` post has no clean body to extract and falls back to `<description>` alone). This very feed ships it — subscribe and read the whole changelog in your reader.

This changelog is a collection, so the feed you may already subscribe to at `/changelog/feed.rss` is now generated — the old hand-written template is gone.

## An index for LLMs — `llms.txt`

The same page data that drives your sitemap now writes an [`llms.txt`](https://llmstxt.org) — a Markdown index of your pages that LLMs and generative engines read to understand a site. Point the option at a filename and it lands in your output dir:

```json
{% raw %}{
  "markup": {
    "options": {
      "llms": { "output": "llms.txt", "full": true }
    }
  }
}{% endraw %}
```

You get an `# H1` title, a `> ` blockquote summary, then `- [title](url): description` links grouped by URL folder — the first folder becomes a `## section`, a second nests as a `### subsection`. Collection sections are ordered newest-first by `date`; `site.url` makes the links absolute. A string (`"llms": "llms.txt"`) is the shorthand; the object form also takes `title`, `description`, `sectionTitle` and an `intro` path — a Markdown file dropped in verbatim for free-form context you author for LLMs.

### The whole corpus — `full: true`

`llms.txt` is the *map*; `full` writes the *territory*. Set `"full": true` and Poops also emits a companion named after `output` with a `-full` suffix (`llms.txt` → **`llms-full.txt`**) — or pass a filename to set it yourself — every page concatenated into one file an LLM can ingest whole. The file opens with a `# Full Documentation Archive for {title}` header, a one-line intro naming the site and a `> ` blockquote of the `description` so a whole-file ingest starts with context, then each page becomes an `# title` (its own leading H1 if it has one) + `URL:` line + its body, joined by `---`. Set `fullIntro` to a Markdown file path for your own preamble after that header — the `full` counterpart to the index's `intro`.

The body is each page's Markdown **source** — the same clean-content approach as the feed's `content: true` — so only `.md`/`.markdown` pages are included (a `.njk`/`.liquid` source is template code, not prose), and `noindex` and collection-index pages are dropped. This site ships one: read [`llms-full.txt`](../llms-full.txt).
