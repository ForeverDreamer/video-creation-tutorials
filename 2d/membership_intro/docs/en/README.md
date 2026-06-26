# Channel intro showcase scenes — free companion pack

Two of the script-built scenes from the channel intro video: an animated photo "hero" card and a pulsing glow grid. Pure After Effects — no plugins, no paid templates, nothing to install. Download, run, tweak the `CONFIG`, run again.

## What's in here

| File | What it is |
|------|------------|
| `code/demo_hero_scene.jsx` | Animated photo hero scene: a rounded photo card with a glowing border, a bold title, an accent ring, floating dots, and a one-node 3D camera flythrough — elements stagger in with a pop, then keep a gentle idle motion. **Asset-optional**: point it at your own photo, or leave it empty for a placeholder card. |
| `code/demo_grid_pulse.jsx` | A diagonal-wave grid of rounded, glowing cells, brought to life by sine expressions on Opacity + Scale. **Zero assets** — the grid is fully generated. |
| `code/assets/SOURCES.md` | Provenance ledger for the one optional photo. The photo itself is NOT bundled — get your own (link below). |

## The photo in the hero scene (optional)

The hero demo runs with **zero assets** — with no photo you get a placeholder card. To use a real photo, **drop any `.jpg`/`.png` into the `code/assets/` folder next to the script** and it auto-loads — no path to type. To match the video, it used a free Pexels cat photo:

- **Cat photo** — Pexels, free, commercial-OK, no attribution required:
  <https://www.pexels.com/photo/cat-lying-on-the-sofa-19511759/>

Download it into `code/assets/`. We don't bundle the image — record the source and download your own (see `code/assets/SOURCES.md`). Prefer an explicit path? Set `IMAGE_PATH` in the script's `CONFIG` to a full path with **forward slashes** (e.g. `"D:/photos/cat.jpg"`, never backslashes); that overrides the auto-detect.

## Run the demos

1. Open After Effects.
2. `File > Scripts > Run Script File...` and pick a demo under `code/`.
3. **Hero scene** → builds a comp with the photo card + camera flythrough; press `0` (numpad) for a RAM preview. **Grid pulse** → fills the active comp (or makes a new one) with the living glow grid; press `0` to preview.

## Make it yours

Everything tweakable lives in the `CONFIG` block at the top of each script.

**`demo_hero_scene.jsx`**

- `IMAGE_PATH` — leave `""` to auto-load a photo from `code/assets/` (just drop one in); or set an explicit path like `"D:/photos/cat.jpg"` (forward slashes) to override.
- `TITLE_TEXT` — the bold title under the photo.
- `PAL` — the palette (`bg` / `card` / `gold` / `teal` / `violet` / `coral` / `title`), each `[r, g, b]` (0–1).
- `CAM_KEYS` — the baked one-node camera flythrough; set it to `[]` for a static default camera.

**`demo_grid_pulse.jsx`**

- `COLS` — grid columns (rows are derived to fill the frame).
- `GAP` — cell gap, in px.
- `PALETTE` — the cyan/teal glow colors, each `[r, g, b]` (0–1).

Change one value, run again, and the whole scene updates.

## One thing worth knowing

- **Hero scene** uses a **one-node camera** (its point-of-interest is null), steered by `Orientation` / `Rotate Z`. Don't add a point-of-interest later — on a one-node camera that can silently break the build or fight your keyframes. Keep it one-node, exactly as the script does.
- **Grid pulse** gets its life from **expressions** (sine on Opacity + Scale), not keyframes — so it loops forever and re-times itself if you change the comp length. The cells are flat 2D shape layers; the motion is purely procedural.

## About this free code

This is the version shown in the video. Running it as-is may need a small tweak — After Effects version, fonts, and OS differences can vary. If you just want to **see how the scene is built**, the script is enough to read and run.

## Want the full version?

The polished, reusable toolkit — the shared `adobe/ae/scripts/common/` helpers behind every episode (cameras, easing, glow, 3D layout, render helpers), the bridge and CLI tooling, and step-by-step environment setup — is in the 2D membership, updated every episode. The join link is in the video description.
