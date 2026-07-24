---
layout: post
title: v1.6.0 — JSON-LD structured data with the jsonld filter
date: 2026-07-25
description: A new jsonld filter emits a schema.org JSON-LD block from a page's front matter — structured data for GEO (Generative Engine Optimization) and rich results, with zero config. The type auto-detects and a front-matter escape hatch gives you full control.
published: true
---

The `jsonld` filter turns a page's front matter into a schema.org [JSON-LD](https://json-ld.org/) `<script type="application/ld+json">` block — the structured data that search engines and generative engines (GEO) read to understand your content. Drop it in your layout `<head>`:

```nunjucks
{% raw %}{{ page | jsonld(site) }}{% endraw %}
```

Liquid uses the colon syntax: `{% raw %}{{ page | jsonld: site }}{% endraw %}`.

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

This very page emits a `BlogPosting` block — view source and look in the `<head>`.
