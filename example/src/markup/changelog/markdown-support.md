---
layout: post
title: Markdown Support
date: 2023-09-20
description: Poops now supports markdown markup. Your markdown files will  be rendered into HTML and combined with Front Matter support it provides an experience similar to Jekyll.
published: true
---

### What?

It's markdown! Drop a `.md` file into your markup `in` directory and it comes out as HTML, at the
same path: `src/markup/about.md` → `dist/about.html`.

### Markdown *and* templates

The file is rendered to HTML first, then handed to the template engine — so template expressions
work inside Markdown, and [Front Matter](front-matter) works exactly like it does on an `.html`
page:

```markdown
---
layout: post
title: Hello world
---

# {% raw %}{{ page.title }}{% endraw %}

Written in Markdown, wrapped in the `post` layout.
```

### Code blocks

Fenced code blocks are syntax-highlighted **at build time**, so you ship a CSS theme instead of a
highlighter:

````markdown
```js
const greet = (name) => `Hello, ${name}!`;
```
````

Combined with front matter, this gets you the Jekyll writing experience without the Ruby.
