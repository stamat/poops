---
layout: blog
title: Liquid Template Engine Support
date: 2026-03-07
description: Poops now supports Liquid as an alternative template engine alongside Nunjucks. Use .liquid files and familiar Liquid syntax for your templates, layouts, and includes.
published: true
---
# {{ page.title }}

> {{ page.description }}

### What's new?

Poops now ships with two template engines: **Nunjucks** (the default) and **Liquid**. You can choose which engine to use by setting the `engine` option in your markup configuration. Both engines support the same feature set — collections, pagination, search index, sitemap, custom tags, and filters.

### Example configuration

```json
{
  "markup": {
    "in": "src/liquid",
    "out": "dist",
    "engine": "liquid"
  }
}
```

### Template syntax differences

Nunjucks and Liquid are similar but have key differences:

- **Includes:** `{% raw %}{% include 'header.liquid' %}{% endraw %}` instead of `{% raw %}{% include 'header.html' %}{% endraw %}`
- **Layouts:** `{% raw %}{% layout 'default.liquid' %}{% endraw %}` instead of `{% raw %}{% extends 'default.html' %}{% endraw %}`
- **Loops:** `{% raw %}{% for item in collection.items %}{% endraw %}` works the same in both

### Same features, different syntax

All Poops features work with both engines:

- Front matter and collections
- Pagination
- Markdown rendering
- Custom filters (`slugify`, `date`, `markdown`, `highlight`, etc.)
- Custom tags (`googleFonts`, `image`, `highlight`)
- Search index and sitemap generation
