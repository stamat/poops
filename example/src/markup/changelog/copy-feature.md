---
layout: post
title: Copy feature
date: 2025-09-19
description: Next to compiling scripts, styles and markup, copy capability is added. Now you can copy the static files into your desired dist directory.
published: true
---

Copy moves files or whole directories from one place to another. Useful for deployments — fonts,
favicons, OG images and everything else that doesn't need compiling still has to land in `dist`.

### Example configuration

A single `{ in, out }` pair, or an array of them. `in` takes a path or an array of paths:

```json
{
  "copy": [
    {
      "in": ["src/static/ogimage.jpg", "src/static/favicon.ico", "src/fonts"],
      "out": "dist"
    },
    { "in": "images", "out": "dist/static" }
  ]
}
```

### Globs

Input paths accept glob and extglob patterns, so you rarely have to list files one by one:

```json
{
  "copy": {
    "in": [
      "images/**/awesome.{jpeg,jpg,png}",
      "notes/info[0-9].txt",
      "assets/!(vendor)/*.js"
    ],
    "out": "dist"
  }
}
```

No more `cp -r` steps glued to the build script.
