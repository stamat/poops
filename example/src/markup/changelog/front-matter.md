---
layout: post
title: Added Front Matter support!
date: 2023-09-19
description: Front matter is an awesome idea! Since the static site generator functionality of Poops is inspired by Jekyll and the genius of peeps that came up with the idea of front matter, I decided to add it to Poops as well. Made things super simple! And that's what Poops is all about. Making things simple.
published: true
---

Adding Front Matter was a breeze. Seriously.

### What?

A YAML block at the top of a page, fenced by `---`. Everything in it becomes page data.

The name is borrowed from book publishing, where the _front matter_ is everything printed before
the story starts — title page, copyright, dedication, table of contents. Metadata about the book,
bound into the book. Same idea here: the page carries its own metadata, in the same file, above the
content.

```markdown
---
layout: default
title: About
description: Who we are and why.
---

# About us

We build things with Poops.
```

### A bit of history

The convention as we know it comes from **[Jekyll](https://jekyllrb.com/)**, written by Tom
Preston-Werner in 2008 — the same person who co-founded GitHub, which is why Jekyll ended up
powering GitHub Pages. The rule Jekyll set is still the rule everywhere: a file that starts with a
`---` fence gets processed by the template engine, and the YAML inside becomes the page's
variables. No fence, no processing.

The YAML part is older still — the format was designed in 2001 by Clark Evans, Ingy döt Net and
Oren Ben-Kiki. Jekyll picked it because it's the least noisy thing a human can type by hand, and
everyone since — Hugo, Eleventy, Astro, Next, and now Poops — has copied the convention rather
than invent a new one. That is the whole point: your posts stay portable. Move them to another
generator and the metadata comes along.

### Why it matters

Two things fall out of it for free:

- **`layout`** picks the template that wraps the page. No more repeating the same `<head>` in every file.
- **Everything else** lands on `page`, so it's readable from the page and from its layout.

Any field you invent is yours to use — `order`, `published`, `nav`, whatever your templates want to read.

```nunjucks
{% raw %}<h1>{{ page.title }}</h1>
<meta name="description" content="{{ page.description }}">{% endraw %}
```

Front matter in, data out.
