---
layout: post
title: Blog Functionality
description: Poops started as a simple script and style bundler, but now it became much more, it became a static site generator. Combining Markdown and Front Matter support we have extended Poops with blogging functionality.
date: 2023-10-12
published: true
---

[Front Matter](front-matter) and [Markdown](markdown-support) were the two halves of a blog. This
is the part that puts them together: **collections**.

### What?

Any direct subdirectory of your markup `in` directory can become a collection. Every file in it —
except `index` — becomes an item, sorted and handed to your templates as one list. Say so in the
front matter of the directory's index:

```yaml
---
title: Blog
collection: true
sort: date
---
```

### Writing a post

A post is a Markdown file with front matter. Nothing new to learn:

```markdown
---
layout: post
title: Hello world
date: 2023-10-12
description: My first post built with Poops.
published: true
---

Welcome to the blog.
```

`published: false` keeps a draft out of the build entirely — no page, no listing.

### Listing them

The collection is a global named after its directory. Loop `items`:

```nunjucks
{% raw %}{% for post in blog.items %}
  <article>
    <h2><a href="{{ relativePathPrefix }}{{ post.url }}">{{ post.title }}</a></h2>
    <time datetime="{{ post.date | date('YYYY-MM-DD') }}">{{ post.date | date("MMMM D, YYYY") }}</time>
    <p>{{ post.description }}</p>
  </article>
{% endfor %}{% endraw %}
```

Each item carries its own front matter plus computed fields like `url`, `date` and `wordcount`.

This changelog you're reading is a collection. Poops eating its own dog food — or whatever the
polite version of that is for a project called Poops.
