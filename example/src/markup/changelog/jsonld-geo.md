---
layout: post
title: v1.6.0 — SEO metadata with the og and jsonld filters
date: 2026-07-25
description: Two new filters emit page metadata from front matter with zero config — og for Open Graph and Twitter card link previews, jsonld for schema.org structured data (GEO). Both auto-detect the page type and ship a front-matter escape hatch for full control.
published: true
---

Two new filters generate the metadata that search engines, generative engines (GEO) and social platforms read — straight from your front matter, no per-page boilerplate. Drop both in your layout `<head>`:

```nunjucks
{% raw %}{{ page | og(site) }}
{{ page | jsonld(site) }}{% endraw %}
```

## Open Graph & Twitter cards — `og`

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

## JSON-LD structured data — `jsonld`

The `jsonld` filter turns front matter into a schema.org [JSON-LD](https://json-ld.org/) `<script type="application/ld+json">` block — structured data search and generative engines read to understand your content. Liquid uses the colon syntax: `{% raw %}{{ page | jsonld: site }}{% endraw %}`.

## What it generates

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

## Full control

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
