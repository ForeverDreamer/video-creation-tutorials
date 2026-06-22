# Matrix Digital Rain — free companion pack

A working, recolorable Matrix-style code rain for After Effects, built entirely by script. No plugins, no paid templates, nothing to install.

## What's in here

| File | What it is |
|------|------------|
| `code/demo_matrix_rain.jsx` | A self-contained script that builds the rain (basic tier): falling green monospace columns, a bottom-bright fading trail, a subtle glow, and brighter lead columns. |
| `prompts.md` | The actual prompts used in the video, in order, to build the rain step by step. |
| `membership.md` | Where the full, reusable toolkit lives. |

## Run the demo

1. Open After Effects.
2. `File > Scripts > Run Script File...` and pick `code/demo_matrix_rain.jsx`.
   (Or, if you use the CLI workflow: `./adobe_cli.sh ae exec-script ".../demo_matrix_rain.jsx"`.)
3. A comp named `Matrix_Rain_Demo` appears, already raining. Press `0` on the numpad for a RAM preview.

## Make it yours

Everything tweakable lives in the `CONFIG` block at the top of the script:

- `fontSize`, `colSpacing` — glyph size and how dense the wall is.
- `strandMin` / `strandMax` — how long each falling strand is.
- `speedMin` / `speedMax` — fall speed range.
- `charset` — the characters that fall (try pure digits: `"0123456789"`).
- `palette` — one-word recolor: switch between `"green"` / `"amber"` / `"blue"` / `"multi"` (three base colors sit under `presets`; `"multi"` mixes them, giving each column a random color).
- `glow.radius` — bloom amount; keep it low to stay sharp.

Change one value, run again, and the whole field updates. The script is one self-contained file — no plugins, no other downloads, no membership needed to run it.

## One thing worth knowing

The trail uses a text-animator selector whose real property name is `ADBE Text Range Shape`. It is easy to assume it is `Type2` (that one is actually "Based On") and get a silent no-op. The script uses the correct name so every column gets the trail.

## Want the full version?

The polished, reusable toolkit — 4-level brightness with white-green lead columns, per-glyph flicker, a glow preset library, one-word recolor across green / amber / blue, and helpers you can drop into any animation, updated every episode — is in the 2D membership. See [`membership.md`](membership.md).
