# 3D Text Flythrough — free companion pack

The flashy 3D text-cloud camera flythrough that opens the WSL2 deployment video, built entirely by script. Pure After Effects 3D (Classic 3D) — no plugins, no paid templates, nothing to install.

## What's in here

| File | What it is |
|------|------------|
| `code/demo_3d_text_flythrough.jsx` | A self-contained script that builds the hook: a dark comp with dozens of bright 3D text layers scattered through a Z-depth volume, plus a one-node camera doing a varied-rhythm flythrough (establishing push, whip pan, dolly-in, orbit, vertigo zoom, boom, dolly-out). |

This demo is **self-contained — zero external assets**. The text cloud is generated procedurally, so there is nothing else to download and nothing bundled.

## Run the demo

1. Open After Effects.
2. `File > Scripts > Run Script File...` and pick `code/demo_3d_text_flythrough.jsx`.
3. A comp named `Text 3D Flythrough Hook` appears. Press `0` on the numpad for a RAM preview and watch the camera fly through the text cloud.

## Make it yours

Everything tweakable lives in the `CONFIG` block at the top of the script:

- `numLayers` — how many 3D text layers fill the cloud (try `120` for a denser wall).
- `durationSec` — total length; the camera's beat timing scales to it.
- `bgColor` — the dark backdrop, as `[r, g, b]` (0–1). Try a deep blue `[0.03, 0.04, 0.10]`.
- `zDepth` — how deep the cloud runs front-to-back (bigger = more dramatic flythrough).
- `fontName`, `fontMin`, `fontMax` — typeface (use a no-space font name) and the glyph size range.
- `seed` — the random seed. **The same seed always builds the exact same cloud**, so once you like a layout you can re-render it precisely; change the seed to roll a new one.
- `forceCpuRender` — leave `true`; it bakes CPU render mode, which avoids intermittent black frames on heavy 3D comps.

Change one value, run again, and the whole shot updates. The script is one self-contained file — no plugins, no other downloads, no membership needed to run it.

## One thing worth knowing

The camera is a **one-node camera** (its point-of-interest is null). Its aim is driven entirely by `Orientation` and `Rotate Z` keyframes — the script never sets a point-of-interest. This matters: if you add a point-of-interest to a one-node camera later, the build can silently break or the aim fights your keyframes. Keep it one-node and steer with Orientation, exactly as the script does.

## About this free code

This is the version shown in the video. Running it as-is may need a small tweak — After Effects version, fonts, and OS differences can vary. If you just want to **see how the hook is built**, the script is enough to read and run.

## Want the full version?

The polished, reusable toolkit — the shared `adobe/ae/scripts/common/` helpers behind every episode (cameras, easing, 3D layout, render helpers), the bridge and CLI tooling, and step-by-step environment setup — is in the 2D membership, updated every episode. The join link is in the video description.
