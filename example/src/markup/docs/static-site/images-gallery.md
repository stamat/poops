---
layout: docs
title: Using images & creating a gallery
navTitle: Images & galleries
description: Process images with poops-images, emit responsive markup with the image tag, and build a photo gallery from EXIF data.
order: 2
keywords: ["images", "gallery", "responsive", "srcset", "webp", "avif", "exif", "poops-images"]
---

# Using images & creating a gallery

Images in Poops are two cooperating parts:

1. **Processing** — the `images` key runs [poops-images](https://github.com/stamat/poops-images) to
   resize, convert (WebP/AVIF), crop and read EXIF. It writes variants and a
   `.poops-images-cache.json`.
2. **Markup** — the `{% raw %}{% image %}{% endraw %}` tag and the `exif`/`images` filters read that
   cache and emit correct HTML.

> [!WARNING]
> poops-images (and its `sharp` dependency) is **not** bundled with Poops. Install it only if you
> use the `images` key: `npm i poops-images`. If the key is present but the package isn't
> installed, Poops logs a warning and skips image processing — the rest of the build still runs.

## Processing images

```json
{
  "images": {
    "in": "src/images",
    "out": "dist/images",
    "sizes": [{ "width": 640 }, { "width": 1280 }],
    "format": "smart"
  }
}
```

- **`in` / `out`** — keep `out` distinct from `in` and outside your watched sources, so generated
  variants don't retrigger the build.
- **`sizes`** — responsive widths to generate.
- **`format`** — e.g. `["webp"]`, or `"smart"` to keep whichever of JPEG/WebP is smaller.

Images are processed **before** markup, so the `{% raw %}{% image %}{% endraw %}` tag and `images`
filter always read a fresh cache.

## Emitting a responsive image

```nunjucks
{% raw %}{% image 'images/hero.jpg', alt='Sunrise', sizes='(max-width: 640px) 100vw, 50vw' %}{% endraw %}
```

With the poops-images cache present you also get exact `width`/`height` attributes (no layout
shift), correct `src` when the source format was converted, and EXIF via the `exif` filter.

## Custom sizes (named crops)

A plain size (`{ "width": 640 }`) is one rung of the responsive ladder. A **named** size is a fixed
crop of its own — WordPress-style `add_image_size` — for a thumbnail, a hero banner, a social card:
each has its own dimensions and crop anchor, independent of the responsive widths.

```json
{
  "images": {
    "in": "src/images",
    "out": "dist/images",
    "sizes": [
      { "width": 640 },
      { "width": 1280 },
      { "name": "thumb", "width": 200, "height": 200, "crop": true },
      { "name": "hero", "width": 1600, "height": 500, "crop": ["center", "top"] }
    ],
    "format": ["webp"]
  }
}
```

For `photo.jpg` that writes `photo-640w.webp` and `photo-1280w.webp` (the responsive ladder) plus
`photo-thumb-200w.webp` and `photo-hero-1600w.webp` (the named crops).

The plain-width variants feed the responsive `srcset` automatically; named crops (and preprocessed
variants like `photo-blurred-640w.webp`) are deliberately kept out of it — they have their own
aspect ratios. To emit one, pass the size name as the **`size` kwarg** — Poops pulls that whole
crop group from the compile cache and builds its own srcset, so soft crops (no fixed height)
resolve too (needs [poops-images](https://github.com/stamat/poops-images) ≥ 1.2.1):

```nunjucks
{% raw %}{# responsive: uses the -640w / -1280w ladder #}
{% image 'images/photo.jpg', alt='Hero', sizes='100vw' %}

{# just the 200×200 thumb crop #}
{% image 'images/photo.jpg', size='thumb', alt='', sizes='200px' %}

{# just the hero banner crop #}
{% image 'images/photo.jpg', size='hero', alt='' %}{% endraw %}
```

Each named reference resolves to that crop group, e.g. `<img src="images/photo-thumb-200w.webp" …>`.

## A photo gallery

The `images` filter lists every image under a directory from the cache. Combine it with
`groupby`, engine-native sorting and the image tag, and a gallery is pure templating — no manual
list to maintain.

```nunjucks
{% raw %}{% for group in 'images' | images | sort(reverse=true, attribute='date') | groupby("date", "year") %}
  <h2>{{ group.key }}</h2>
  <div class="grid">
    {% for img in group.items %}
      <figure>
        {% image img.path, alt='', sizes='(max-width: 640px) 50vw, 25vw' %}
        {% if img.exif and img.exif.gps %}
          <figcaption>
            <a href="{{ img.exif.gps.googleMapsUrl }}">📍</a> {{ img.date | date("MMM D, YYYY") }}
          </figcaption>
        {% endif %}
      </figure>
    {% endfor %}
  </div>
{% endfor %}{% endraw %}
```

Each `img` exposes `path` (feeds straight into the image tag), `width`, `height`, `date`
(EXIF date if present, else file mtime), `exif`, and `outputs` (every generated file).

## EXIF captions

The `exif` filter returns camera, exposure, timestamp and GPS metadata:

```nunjucks
{% raw %}{% set meta = 'images/photo.jpeg' | exif %}
<figure>
  {% image 'images/photo.jpeg', alt='At dusk' %}
  {% if meta %}
    <figcaption>
      {{ meta.dateTime | date("MMMM D, YYYY") }}
      {% if meta.gps %} — <a href="{{ meta.gps.googleMapsUrl }}">{{ meta.gps.latitude.formatted }}, {{ meta.gps.longitude.formatted }}</a>{% endif %}
      {% if meta.model %} · {{ meta.model }}{% endif %}
    </figcaption>
  {% endif %}
</figure>{% endraw %}
```

> [!TIP]
> In watch mode, adding a source image processes it and rebuilds the galleries that reference it;
> deleting one removes its variants and updates the galleries. You never hand-edit an image list.

Next: [A documentation site](docs-site).
