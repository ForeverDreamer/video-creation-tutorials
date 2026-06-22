# The prompts (in order)

These are the exact prompts used in the video, step by step. Each one describes the *result* we want, not the clicks. After Effects does the work; the script just gets written faster.

> The demo in `code/demo_matrix_rain.jsx` is the basic-tier result. These prompts show the full build, including the brightness layering and the one-place recolor.

**1. The first pass — describe the finished look, not steps**

```
black canvas, green monospace character columns falling top to bottom
```

You get plain green columns already falling. No glow, no trail yet.

**2. Add the glow**

```
add a glow so the glyphs bloom
```

First pass blooms too much and the glyphs turn to mush.

**3. Pull the glow back**

```
glow too heavy, radius down to 8, keep glyphs sharp
```

Now the glyphs are sharp and still glowing.

**4. Add the signature trail**

```
add the signature bottom-bright, top-fading trail
```

This is the Matrix look: brightest at the bottom of each strand, fading toward the top. (Heads up: the text-animator property is `ADBE Text Range Shape`, not `Type2`.)

**5. Density**

```
tighten columns and lengthen strands for density
```

The field goes from sparse to a dense wall.

**6. Brightness layering**

```
add brightness layering: a few near-white lead columns, then bright / mid / dim greens
```

A few near-white lead columns over bright / mid / dim greens. Now a single glance reads as Matrix.

**7. One place to control everything**

```
pull these into a CONFIG block so I can recolor in one place
```

Every value moves into one CONFIG block. Change one word and the whole field recolors — green to amber to blue — or swap the character set to pure digits.

---

The reusable, productized version of all of this (per-glyph flicker, a glow preset library, one-word recolor, helpers for any animation) is in the 2D membership — see [`membership.md`](membership.md).
