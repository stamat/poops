---
layout: post
title: v1.7.0 — breadcrumbs, JSON-LD and a filter
date: 2026-07-26
description: Nested pages now auto-emit a BreadcrumbList rich result through the jsonld filter, and a new breadcrumb filter renders a visible trail from the same URL-depth data — with local-safe relative links and an optional home crumb.
published: true
---

Breadcrumbs land in two forms, both derived from a page's URL depth — no nav tree wiring, no per-page boilerplate.

## The SEO half is automatic

The `jsonld` filter already in your `<head>` now auto-appends a schema.org `BreadcrumbList` block on any **nested** page (its `url` has at least one folder). It's a [Google breadcrumb rich result](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) with zero extra markup:

```nunjucks
{% raw %}{{ page | jsonld(site) }}{% endraw %}
```

The trail is the site root, each ancestor folder (humanized — `docs/static-site` → *Static Site*), then the page itself. Item URLs are absolute, so it needs `site.url` (same requirement as `canonical`). Sits right alongside the existing homepage `WebSite` block.

## A visible trail — `breadcrumb`

For a breadcrumb people can see and click, add the new `breadcrumb` filter in your body. Same crumbs, rendered as a `{% raw %}<nav class="breadcrumb"><ol>{% endraw %}`:

```nunjucks
{% raw %}{{ page | breadcrumb(site, relativePathPrefix) }}{% endraw %}
```

Liquid uses the colon syntax: `{% raw %}{{ page | breadcrumb: site, relativePathPrefix }}{% endraw %}`.

Passing `relativePathPrefix` matters: the links resolve against the current page — localhost while you develop, your deployed path in production — instead of jumping to the absolute domain. It's the same convention the nav and header links already use. The last crumb is the current page, rendered as `aria-current` text rather than a link. Both the JSON-LD and the visible trail return nothing on the homepage or a single-crumb page. Style the `.breadcrumb` however you like.

## Optional home crumb

The leading "Home" crumb is on by default. Drop it or rename it site-wide via `site.breadcrumb`, or per page in front matter — front matter wins:

```yaml
# poops.json → markup.site
breadcrumb:
  home: false        # drop the leading "Home" crumb
  homeLabel: Start   # …or just rename it
```

With `home: false`, top-level pages fall to a single crumb and render nothing, while nested pages still show their folder trail — handy for a blog where you want *Blog › Post*, not *Home › Blog › Post*. Set `breadcrumb: false` on a page (or on `site`) to switch off both the visible trail and the JSON-LD entirely.

The docs pages and these changelog posts render a live trail — look just above the content, and view source for the `BreadcrumbList` in the `<head>`.
